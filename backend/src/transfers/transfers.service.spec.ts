import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { CorridorsService } from '../corridors/corridors.service';
import { ComplianceService } from '../compliance/compliance.service';
import { TransfersGateway } from './transfers.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';

/**
 * These cover one thing: a transfer reports the beneficiary it was *created*
 * with, not whatever the saved recipient happens to look like now.
 *
 * Transfers used to read the beneficiary through the `recipientId` relation.
 * Because a customer can edit a saved recipient at any time, that made a
 * completed transfer's own record mutable after the fact — edit the bank
 * account and a delivered transfer's receipt would show an account the money
 * had never been sent to. The snapshot columns on Transfer exist to stop that,
 * and these tests fail if anything reintroduces the join.
 */

function createMockPrisma() {
  return {
    transfer: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

/** A transfer whose snapshot deliberately disagrees with the current recipient
 *  row, which is exactly the situation the snapshot exists to survive. */
function transferRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't-1',
    userId: 'u-1',
    recipientId: 'r-1',
    recipientName: 'Ayesha Khan',
    recipientCountry: 'PK',
    recipientBankAccount: 'PK36SCBL0000001123456702',
    recipientBankName: 'Standard Chartered',
    recipientBankCode: 'SCBLPKKX',
    sendAmount: new Prisma.Decimal('250.00'),
    sendCurrency: 'CAD',
    receiveAmount: new Prisma.Decimal('49500.00'),
    receiveCurrency: 'PKR',
    fxRateApplied: new Prisma.Decimal('198.00000000'),
    feeAmount: new Prisma.Decimal('2.50'),
    status: 'delivered',
    idempotencyKey: 'idem-1',
    providerName: 'mock',
    providerRef: null,
    failureReason: null,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    updatedAt: new Date('2026-08-01T10:00:30Z'),
    ...overrides,
  };
}

describe('TransfersService — beneficiary snapshot', () => {
  let service: TransfersService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const stub = {} as unknown;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: stub },
        { provide: CorridorsService, useValue: stub },
        { provide: ComplianceService, useValue: stub },
        { provide: TransfersGateway, useValue: stub },
        { provide: NotificationsService, useValue: stub },
        { provide: ReferralsService, useValue: stub },
        {
          provide: LedgerService,
          useValue: {
            post: jest.fn().mockResolvedValue('posting-1'),
            systemAccountId: jest.fn().mockResolvedValue('sys-account'),
            customerAccount: jest.fn(),
            balance: jest.fn(),
          },
        },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get(TransfersService);
  });

  describe('list', () => {
    it('reports the beneficiary recorded on the transfer', async () => {
      prisma.transfer.findMany.mockResolvedValue([transferRow()]);

      const [summary] = await service.list('u-1');

      expect(summary.recipient).toEqual({ name: 'Ayesha Khan', country: 'PK' });
    });

    it('does not join the recipient relation', async () => {
      prisma.transfer.findMany.mockResolvedValue([]);

      await service.list('u-1');

      const args = prisma.transfer.findMany.mock.calls[0][0] as {
        include?: Record<string, unknown>;
      };
      // A join here is the bug: it would make the response follow later edits
      // to the saved recipient rather than reporting what the transfer did.
      expect(args.include?.recipient).toBeUndefined();
    });
  });

  describe('get', () => {
    it('reports the full beneficiary recorded on the transfer', async () => {
      prisma.transfer.findUnique.mockResolvedValue(
        transferRow({ timeline: [] }),
      );

      const detail = await service.get('u-1', 't-1');

      expect(detail.recipient).toEqual({
        name: 'Ayesha Khan',
        country: 'PK',
        bankAccount: 'PK36SCBL0000001123456702',
        bankName: 'Standard Chartered',
        bankCode: 'SCBLPKKX',
      });
    });

    it('is unaffected when the saved recipient is edited afterwards', async () => {
      // The relation now carries completely different banking details — the
      // customer reused the saved recipient for someone else. The delivered
      // transfer must still report where the money actually went.
      prisma.transfer.findUnique.mockResolvedValue(
        transferRow({
          timeline: [],
          recipient: {
            id: 'r-1',
            name: 'Someone Else',
            country: 'IN',
            bankAccount: 'IN00XXXX0000000000000000',
            bankName: 'A Different Bank',
            bankCode: 'XXXXIN00',
          },
        }),
      );

      const detail = await service.get('u-1', 't-1');

      expect(detail.recipient.name).toBe('Ayesha Khan');
      expect(detail.recipient.bankAccount).toBe('PK36SCBL0000001123456702');
    });

    it('still refuses a transfer belonging to another user', async () => {
      prisma.transfer.findUnique.mockResolvedValue(
        transferRow({ userId: 'someone-else', timeline: [] }),
      );

      await expect(service.get('u-1', 't-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
