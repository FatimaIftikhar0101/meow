import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScreeningService } from './screening.service';

/**
 * Screening, and the two consequences it must keep apart.
 *
 * **The blocklist blocks.** It runs before anything is written, so a refusal
 * leaves no transfer and no ledger entry behind.
 *
 * **The rules only alert.** They run after the payment is accepted and must
 * never throw into it. A rule engine that can fail a payment is one that will
 * eventually fail every payment because somebody shipped a bad heuristic on a
 * Friday — so the failure mode is asserted here, not assumed.
 */

const D = (n: string) => new Prisma.Decimal(n);

function createMockPrisma() {
  return {
    blocklistEntry: {
      findFirst: jest.fn<
        Promise<unknown>,
        [
          {
            where: {
              active: boolean;
              OR: Array<{ kind: string; value: string }>;
            };
          },
        ]
      >(),
    },
    transfer: { findMany: jest.fn().mockResolvedValue([]) },
    corridor: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c-1', active: true }),
    },
    complianceAlert: {
      createMany: jest.fn<
        Promise<unknown>,
        [{ data: Array<{ rule: string; severity: string; detail: unknown }> }]
      >(),
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

const TRANSFER = {
  id: 't-1',
  userId: 'u-1',
  sendAmount: D('100.00'),
  sendCurrency: 'CAD',
  recipientCountry: 'PK',
};

describe('ScreeningService', () => {
  let service: ScreeningService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ScreeningService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ScreeningService);
  });

  const rulesRaised = () =>
    (prisma.complianceAlert.createMany.mock.calls[0]?.[0].data ?? []).map(
      (a) => a.rule,
    );

  describe('normalise', () => {
    it('is the same function on both sides of a match', () => {
      // Screening and the blocklist writer both call this. Two
      // implementations that agree today are the bug waiting to happen.
      expect(ScreeningService.normalise('  Ayesha   KHAN ')).toBe(
        'ayesha khan',
      );
      expect(ScreeningService.normalise('PK')).toBe('pk');
    });
  });

  describe('assertNotBlocked', () => {
    const input = {
      recipientName: 'Ayesha Khan',
      recipientCountry: 'PK',
      bankAccount: 'v1.abc.def.ghi',
      email: null,
    };

    it('passes when nothing matches', async () => {
      prisma.blocklistEntry.findFirst.mockResolvedValue(null);
      await expect(service.assertNotBlocked(input)).resolves.toBeUndefined();
    });

    it('refuses on a match', async () => {
      prisma.blocklistEntry.findFirst.mockResolvedValue({
        id: 'b-1',
        kind: 'name',
      });
      await expect(service.assertNotBlocked(input)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('does not tell the sender which field matched', async () => {
      prisma.blocklistEntry.findFirst.mockResolvedValue({
        id: 'b-1',
        kind: 'account',
      });
      // Naming the field would turn the product into an oracle for testing
      // names and account numbers against the list.
      await expect(service.assertNotBlocked(input)).rejects.toThrow(
        /cannot be sent. Please contact support/,
      );
    });

    it('matches on normalised values, not on what was typed', async () => {
      prisma.blocklistEntry.findFirst.mockResolvedValue(null);
      await service.assertNotBlocked({
        ...input,
        recipientName: '  AYESHA   khan  ',
      });
      const where = prisma.blocklistEntry.findFirst.mock.calls[0][0].where;
      expect(where.OR).toContainEqual({ kind: 'name', value: 'ayesha khan' });
      expect(where.OR).toContainEqual({ kind: 'country', value: 'pk' });
    });

    it('only consults active entries', async () => {
      prisma.blocklistEntry.findFirst.mockResolvedValue(null);
      await service.assertNotBlocked(input);
      const where = prisma.blocklistEntry.findFirst.mock.calls[0][0].where;
      // Entries are deactivated rather than deleted, so an inactive one must
      // not still refuse payments.
      expect(where.active).toBe(true);
    });
  });

  describe('screenTransfer', () => {
    it('raises nothing for an ordinary payment', async () => {
      await service.screenTransfer(TRANSFER);
      expect(prisma.complianceAlert.createMany).not.toHaveBeenCalled();
    });

    it('flags a large payment, and harder once past the reporting threshold', async () => {
      await service.screenTransfer({ ...TRANSFER, sendAmount: D('8000') });
      expect(rulesRaised()).toContain('large_amount');
      expect(
        prisma.complianceAlert.createMany.mock.calls[0][0].data[0].severity,
      ).toBe('medium');

      prisma.complianceAlert.createMany.mockClear();
      await service.screenTransfer({ ...TRANSFER, sendAmount: D('12000') });
      expect(
        prisma.complianceAlert.createMany.mock.calls[0][0].data[0].severity,
      ).toBe('high');
    });

    it('flags too many payments in a day', async () => {
      prisma.transfer.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          id: `t-${i}`,
          sendAmount: D('10'),
          sendCurrency: 'CAD',
          createdAt: new Date(),
        })),
      );
      await service.screenTransfer(TRANSFER);
      expect(rulesRaised()).toContain('velocity');
    });

    it('flags payments that stay under the threshold and cross it together', async () => {
      // The pattern the threshold itself creates: four payments of 2,600 is
      // 10,400 with nothing individually declarable.
      prisma.transfer.findMany.mockResolvedValue(
        Array.from({ length: 4 }, (_, i) => ({
          id: `t-${i}`,
          sendAmount: D('2600'),
          sendCurrency: 'CAD',
          createdAt: new Date(),
        })),
      );
      await service.screenTransfer(TRANSFER);
      expect(rulesRaised()).toContain('structuring');
    });

    it('does not call one declared payment structuring', async () => {
      // A single payment over the line is declared and unremarkable. Calling
      // it structuring would bury the real pattern in noise.
      prisma.transfer.findMany.mockResolvedValue([
        {
          id: 't-0',
          sendAmount: D('15000'),
          sendCurrency: 'CAD',
          createdAt: new Date(),
        },
        {
          id: 't-1',
          sendAmount: D('20'),
          sendCurrency: 'CAD',
          createdAt: new Date(),
        },
      ]);
      await service.screenTransfer(TRANSFER);
      expect(rulesRaised()).not.toContain('structuring');
    });

    it('does not add up across different currencies', async () => {
      prisma.transfer.findMany.mockResolvedValue([
        {
          id: 't-0',
          sendAmount: D('9000'),
          sendCurrency: 'CAD',
          createdAt: new Date(),
        },
        {
          id: 't-1',
          sendAmount: D('9000'),
          sendCurrency: 'USD',
          createdAt: new Date(),
        },
      ]);
      await service.screenTransfer(TRANSFER);
      expect(rulesRaised()).not.toContain('structuring');
    });

    it('flags a destination with no corridor', async () => {
      prisma.corridor.findFirst.mockResolvedValue(null);
      await service.screenTransfer(TRANSFER);
      expect(rulesRaised()).toContain('unknown_corridor');
    });

    it('never throws into the payment path', async () => {
      // The property that matters most here. The money has already moved by
      // the time this runs; a heuristic failing must not surface as an error
      // on a completed payment.
      prisma.transfer.findMany.mockRejectedValue(new Error('database on fire'));
      await expect(service.screenTransfer(TRANSFER)).resolves.toBeUndefined();
    });

    it('does not throw when writing the alerts fails either', async () => {
      prisma.complianceAlert.createMany.mockRejectedValue(
        new Error('write failed'),
      );
      await expect(
        service.screenTransfer({ ...TRANSFER, sendAmount: D('9000') }),
      ).resolves.toBeUndefined();
    });
  });
});
