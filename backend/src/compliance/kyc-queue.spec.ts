import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ComplianceService } from './compliance.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

/**
 * The identity queue, and the line between deciding and overturning.
 *
 * Two things here are easy to get wrong in ways that look fine.
 *
 * **Only the latest record per customer is a live case.** A customer who
 * failed and later passed has two rows; showing the older one puts a settled
 * case back in the queue, and somebody reviews it again.
 *
 * **A decision resolves the open case rather than stacking a row on top.**
 * Creating a new record would leave the original looking permanently
 * unreviewed, so the queue would never empty and the age on it would climb
 * forever.
 */

const REVIEWER: AuthUser = {
  id: 'comp-1',
  email: 'compliance@meow.test',
} as AuthUser;

/** Prisma call arguments, typed so assertions read against a shape rather
 *  than `any` off a jest mock. */
type Row = Record<string, unknown>;
type FindArgs = {
  where: { OR?: Array<{ userId: string; createdAt: Date }> } & Row;
  orderBy?: Array<Record<string, string>>;
};

function createMockPrisma() {
  const client = {
    kycRecord: {
      groupBy: jest.fn(),
      findMany: jest.fn<Promise<unknown[]>, [FindArgs]>(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn<Promise<unknown>, [{ where: Row; data: Row }]>(),
      create: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn<Promise<unknown>, [{ data: Row }]>() },
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation(
    (fn: (t: typeof client) => Promise<unknown>) => fn(client),
  );
  return client;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('KYC queue', () => {
  let service: ComplianceService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ComplianceService);
  });

  describe('listForReview', () => {
    it('returns nothing without querying when there are no records at all', async () => {
      prisma.kycRecord.groupBy.mockResolvedValue([]);
      const result = await service.listForReview({});
      expect(result.items).toEqual([]);
      expect(prisma.kycRecord.findMany).not.toHaveBeenCalled();
    });

    it('narrows to the latest record per customer', async () => {
      const newest = new Date('2026-08-01');
      prisma.kycRecord.groupBy.mockResolvedValue([
        { userId: 'u-1', _max: { createdAt: newest } },
      ]);
      prisma.kycRecord.findMany.mockResolvedValue([]);
      prisma.kycRecord.count.mockResolvedValue(0);

      await service.listForReview({});

      const args = prisma.kycRecord.findMany.mock.calls[0][0];
      // A superseded row must not come back, or a settled case reappears in
      // the queue and gets reviewed twice.
      expect(args.where.OR).toEqual([{ userId: 'u-1', createdAt: newest }]);
    });

    it('puts pending first and oldest first within it', async () => {
      prisma.kycRecord.groupBy.mockResolvedValue([
        { userId: 'u-1', _max: { createdAt: new Date() } },
      ]);
      prisma.kycRecord.findMany.mockResolvedValue([]);
      prisma.kycRecord.count.mockResolvedValue(0);

      await service.listForReview({});

      const args = prisma.kycRecord.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual([{ status: 'asc' }, { createdAt: 'asc' }]);
    });

    it('flags a pending case older than a working day and not a decided one', async () => {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      prisma.kycRecord.groupBy.mockResolvedValue([
        { userId: 'u-1', _max: { createdAt: twoDaysAgo } },
      ]);
      prisma.kycRecord.findMany.mockResolvedValue([
        { id: 'k-1', userId: 'u-1', status: 'pending', createdAt: twoDaysAgo },
        { id: 'k-2', userId: 'u-2', status: 'passed', createdAt: twoDaysAgo },
      ]);
      prisma.kycRecord.count.mockResolvedValue(2);

      const result = await service.listForReview({});
      expect(result.items[0].overdue).toBe(true);
      expect(result.items[0].ageMinutes).toBeGreaterThan(2800);
      // A decided case is not overdue however long ago it was decided.
      expect(result.items[1].overdue).toBe(false);
    });
  });

  describe('decide', () => {
    it('resolves the open case rather than stacking a new row on it', async () => {
      prisma.kycRecord.findFirst.mockResolvedValue({
        id: 'k-1',
        status: 'pending',
      });

      await service.decide(REVIEWER, 'u-1', 'passed', 'Documents match');

      expect(prisma.kycRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'k-1' } }),
      );
      // A new row would leave the original looking permanently unreviewed, so
      // the queue would never empty.
      expect(prisma.kycRecord.create).not.toHaveBeenCalled();
    });

    it('records who reviewed it and when', async () => {
      prisma.kycRecord.findFirst.mockResolvedValue({
        id: 'k-1',
        status: 'pending',
      });

      await service.decide(REVIEWER, 'u-1', 'passed', 'Documents match');

      const data = prisma.kycRecord.update.mock.calls[0][0].data;
      expect(data.reviewedById).toBe(REVIEWER.id);
      expect(data.reviewedAt).toBeInstanceOf(Date);
      expect(data.verifiedAt).toBeInstanceOf(Date);
    });

    it('leaves verifiedAt empty on a failure', async () => {
      prisma.kycRecord.findFirst.mockResolvedValue({
        id: 'k-1',
        status: 'pending',
      });
      await service.decide(REVIEWER, 'u-1', 'failed', 'Document expired');
      const data = prisma.kycRecord.update.mock.calls[0][0].data;
      expect(data.verifiedAt).toBeNull();
    });

    it('refuses to decide a case that is already settled', async () => {
      prisma.kycRecord.findFirst.mockResolvedValue({
        id: 'k-1',
        status: 'passed',
      });
      // Overturning is an override, a different permission and a different
      // audit action — so this must not quietly become one.
      await expect(
        service.decide(REVIEWER, 'u-1', 'failed', 'changed my mind'),
      ).rejects.toThrow(/already passed/);
      expect(prisma.kycRecord.update).not.toHaveBeenCalled();
    });

    it('refuses a customer with no identity check at all', async () => {
      prisma.kycRecord.findFirst.mockResolvedValue(null);
      await expect(
        service.decide(REVIEWER, 'u-1', 'passed', 'nothing to decide'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('writes an audit action distinct from an override', async () => {
      prisma.kycRecord.findFirst.mockResolvedValue({
        id: 'k-1',
        status: 'pending',
      });
      await service.decide(REVIEWER, 'u-1', 'passed', 'Documents match');

      const audit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(audit.action).toBe('admin.kyc.decide.passed');
      expect(audit.reason).toBe('Documents match');
    });
  });
});
