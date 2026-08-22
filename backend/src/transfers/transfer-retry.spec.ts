import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, TransferStatus } from '@prisma/client';
import { ComplianceService } from '../compliance/compliance.service';
import { CorridorsService } from '../corridors/corridors.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ReferralsService } from '../referrals/referrals.service';
import { WalletService } from '../wallet/wallet.service';
import { TransfersGateway } from './transfers.gateway';
import { TransfersService } from './transfers.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

/**
 * Retry: the remedy that sat between "wait" and "kill it".
 *
 * Before this existed the only write an operations analyst had on a stuck
 * transfer was force-fail, so a slow payout and a dead payout produced the same
 * outcome for the customer — money back, nothing achieved, start again.
 *
 * Two properties matter enough to pin down. It must refuse a terminal transfer,
 * because a failed one has already been refunded and driving it forward again
 * pays out money that was credited back. And it must leave an audit entry even
 * when the attempt itself fails, because a log that records only successful
 * interventions is precisely the log a reviewer cannot use.
 */

const STAFF: AuthUser = {
  id: 'staff-1',
  email: 'ops@meow.test',
} as AuthUser;

function createMockPrisma() {
  const client = {
    transfer: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    transferEvent: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  // The status change, its timeline entry and any ledger posting commit
  // together, so `advance` now runs them inside one transaction. Handing the
  // callback the same mock keeps the assertions below reading against one
  // object rather than two.
  client.$transaction.mockImplementation(
    (fn: (t: typeof client) => Promise<unknown>) => fn(client),
  );
  return client;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

function transferRow(status: TransferStatus) {
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
    status,
    idempotencyKey: 'idem-1',
    providerName: 'mock',
    providerRef: null,
    failureReason: null,
    createdAt: new Date('2026-08-22T08:00:00Z'),
    updatedAt: new Date('2026-08-22T08:05:00Z'),
    timeline: [],
  };
}

describe('TransfersService.adminRetry', () => {
  let service: TransfersService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: {} },
        { provide: CorridorsService, useValue: {} },
        {
          provide: ComplianceService,
          useValue: { requirePassed: jest.fn().mockResolvedValue(true) },
        },
        { provide: TransfersGateway, useValue: { emitStatus: jest.fn() } },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ReferralsService,
          useValue: {
            onTransferDelivered: jest.fn().mockResolvedValue(undefined),
          },
        },
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

  it('refuses a transfer that does not exist', async () => {
    prisma.transfer.findUnique.mockResolvedValue(null);

    await expect(
      service.adminRetry(STAFF, 't-1', 'customer chasing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe.each<TransferStatus>(['delivered', 'failed', 'cancelled'])(
    'against a %s transfer',
    (status) => {
      it('refuses, and writes nothing', async () => {
        prisma.transfer.findUnique.mockResolvedValue(transferRow(status));

        await expect(
          service.adminRetry(STAFF, 't-1', 'customer chasing'),
        ).rejects.toBeInstanceOf(ForbiddenException);

        // The important half: no timeline entry and no attempt to advance. A
        // refunded transfer driven forward pays out money already returned.
        expect(prisma.transferEvent.create).not.toHaveBeenCalled();
        expect(prisma.transfer.updateMany).not.toHaveBeenCalled();
      });
    },
  );

  it('records the attempt on the timeline before advancing', async () => {
    prisma.transfer.findUnique
      // adminRetry's own read
      .mockResolvedValueOnce(transferRow('payout_processing'))
      // advance()'s read
      .mockResolvedValueOnce(transferRow('payout_processing'))
      // the post-advance status read
      .mockResolvedValueOnce({ status: 'delivered' })
      // the final get()
      .mockResolvedValueOnce(transferRow('delivered'));
    prisma.transfer.updateMany.mockResolvedValue({ count: 1 });

    await service.adminRetry(STAFF, 't-1', 'customer chasing since Tuesday');

    const events = prisma.transferEvent.create.mock.calls.map(
      (c) => (c[0] as { data: { message: string; status: string } }).data,
    );
    const annotation = events[0];
    // Written against the status it was stuck in, so the timeline reads as an
    // annotation at that point rather than as a transition of its own.
    expect(annotation.status).toBe('payout_processing');
    expect(annotation.message).toContain('ops@meow.test');
    expect(annotation.message).toContain('customer chasing since Tuesday');
  });

  it('audits the attempt with the status it actually reached', async () => {
    prisma.transfer.findUnique
      .mockResolvedValueOnce(transferRow('payout_processing'))
      .mockResolvedValueOnce(transferRow('payout_processing'))
      .mockResolvedValueOnce({ status: 'delivered' })
      .mockResolvedValueOnce(transferRow('delivered'));
    prisma.transfer.updateMany.mockResolvedValue({ count: 1 });

    await service.adminRetry(STAFF, 't-1', 'customer chasing');

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const entry = (
      prisma.auditLog.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(entry.action).toBe('admin.transfer.retry');
    expect(entry.actorEmail).toBe('ops@meow.test');
    expect(entry.reason).toBe('customer chasing');
    expect(entry.beforeValue).toEqual({ status: 'payout_processing' });
    expect(entry.afterValue).toEqual({ status: 'delivered' });
  });

  it('still audits when the attempt itself throws', async () => {
    prisma.transfer.findUnique
      .mockResolvedValueOnce(transferRow('payout_processing'))
      .mockResolvedValueOnce(transferRow('payout_processing'));
    // The provider call — here, the status write — blows up mid-retry.
    prisma.transfer.updateMany.mockRejectedValue(new Error('provider timeout'));

    await expect(
      service.adminRetry(STAFF, 't-1', 'stuck for four hours'),
    ).rejects.toThrow('provider timeout');

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const entry = (
      prisma.auditLog.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(entry.reason).toBe('stuck for four hours');
    // Nothing moved, and the log says so rather than saying nothing.
    expect(entry.afterValue).toEqual({ status: 'payout_processing' });
  });
});
