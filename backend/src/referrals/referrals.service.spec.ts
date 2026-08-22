import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ReferralsService } from './referrals.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';

function createMockPrisma() {
  const tx = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    referral: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    ledgerAccount: { findFirst: jest.fn() },
    ledgerEntry: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn() as jest.Mock,
    $queryRaw: jest.fn(),
  };
  tx.$transaction.mockImplementation((fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  return tx;
}

type MockPrisma = ReturnType<typeof createMockPrisma>;
let mockTx: MockPrisma;

const mockNotifications = () => ({
  create: jest.fn().mockResolvedValue(undefined),
});

const mockLedger = () => ({
  post: jest.fn().mockResolvedValue('posting-1'),
  systemAccountId: jest.fn().mockResolvedValue('expense.marketing.CAD'),
  customerAccount: jest.fn(),
  balance: jest.fn(),
});

describe('ReferralsService', () => {
  let service: ReferralsService;
  let prisma: MockPrisma;
  let notifications: ReturnType<typeof mockNotifications>;
  let ledger: ReturnType<typeof mockLedger>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockTx = prisma;
    notifications = mockNotifications();
    ledger = mockLedger();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgerService, useValue: ledger },
        { provide: ConfigService, useValue: { get: (key: string) => key === 'REFERRAL_REWARD_AMOUNT' ? 15 : undefined } },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(ReferralsService);
  });

  describe('getOrCreateCode', () => {
    it('returns existing code if user already has one', async () => {
      prisma.user.findUnique.mockResolvedValue({ referralCode: 'EXISTING1' });
      const code = await service.getOrCreateCode('user-1');
      expect(code).toBe('EXISTING1');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('generates a new code when user has none', async () => {
      prisma.user.findUnique.mockResolvedValue({ referralCode: null });
      prisma.user.update.mockResolvedValue({ referralCode: 'ABCD5678' });
      const code = await service.getOrCreateCode('user-1');
      expect(code).toHaveLength(8);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { referralCode: expect.any(String) },
      });
    });

    it('retries on unique constraint collision', async () => {
      prisma.user.findUnique.mockResolvedValue({ referralCode: null });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.0.0',
      });
      prisma.user.update
        .mockRejectedValueOnce(p2002)
        .mockResolvedValueOnce({ referralCode: 'RETRY123' });
      const code = await service.getOrCreateCode('user-1');
      expect(code).toHaveLength(8);
      expect(prisma.user.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('attachReferral', () => {
    it('creates a pending referral for a valid code', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'referrer-1' });
      prisma.referral.findUnique.mockResolvedValue(null);
      mockTx.referral.create.mockResolvedValue({});
      mockTx.auditLog.create.mockResolvedValue({});

      await service.attachReferral('referee-1', 'VALIDCODE');

      expect(mockTx.referral.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referrerId: 'referrer-1',
          refereeId: 'referee-1',
          code: 'VALIDCODE',
        }),
      });
    });

    it('silently ignores an invalid code', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await service.attachReferral('referee-1', 'BADCODE');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('blocks self-referral', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      await service.attachReferral('user-1', 'SELFCODE');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('blocks double referral (referee already referred)', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'referrer-1' });
      prisma.referral.findUnique.mockResolvedValue({ id: 'existing-referral' });
      await service.attachReferral('referee-1', 'VALIDCODE');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('onTransferDelivered', () => {
    /** The read that establishes which currency the bonus is paid in. */
    function givenReferrerWalletCurrency(currency: string | null) {
      mockTx.referral.findUnique.mockResolvedValueOnce(
        currency
          ? { referrer: { ledgerAccounts: [{ currency }] } }
          : { referrer: { ledgerAccounts: [] } },
      );
    }

    it('credits the referrer exactly once when transfer is delivered', async () => {
      givenReferrerWalletCurrency('CAD');
      mockTx.referral.updateMany.mockResolvedValue({ count: 1 });
      mockTx.referral.findUnique.mockResolvedValueOnce({
        id: 'ref-1',
        referrerId: 'referrer-1',
        refereeId: 'referee-1',
        status: 'rewarded',
        referrer: { id: 'referrer-1', suspended: false },
      });
      mockTx.ledgerAccount.findFirst.mockResolvedValue({
        id: 'wallet-1',
        currency: 'CAD',
      });
      mockTx.$queryRaw.mockResolvedValue([]);
      mockTx.auditLog.create.mockResolvedValue({});

      await service.onTransferDelivered('referee-1', 'transfer-1');

      expect(mockTx.referral.updateMany).toHaveBeenCalledWith({
        where: { refereeId: 'referee-1', status: 'pending' },
        data: expect.objectContaining({
          status: 'rewarded',
          qualifyingTransferId: 'transfer-1',
        }),
      });

      // Both sides. The credit alone was the whole posting before, which made
      // the bonus appear from nowhere and left the cost of the referral
      // programme recorded in no account at all.
      expect(ledger.post).toHaveBeenCalledTimes(1);
      const posting = ledger.post.mock.calls[0][1] as {
        key: string;
        currency: string;
        legs: Array<{ direction: string; amount: Prisma.Decimal }>;
      };
      expect(posting.key).toBe('referral:ref-1:bonus');
      expect(posting.currency).toBe('CAD');
      expect(posting.legs).toHaveLength(2);
      const credit = posting.legs.find((l) => l.direction === 'credit');
      const debit = posting.legs.find((l) => l.direction === 'debit');
      expect(credit?.amount).toEqual(new Prisma.Decimal(15));
      expect(debit?.amount).toEqual(new Prisma.Decimal(15));
    });

    it('pays nothing when the referrer has no wallet to pay into', async () => {
      givenReferrerWalletCurrency(null);

      await service.onTransferDelivered('referee-1', 'transfer-1');

      // And does not mark the referral rewarded on the way past, which would
      // burn the reward without ever paying it.
      expect(mockTx.referral.updateMany).not.toHaveBeenCalled();
      expect(ledger.post).not.toHaveBeenCalled();
    });

    it('is a no-op on second call (idempotency)', async () => {
      givenReferrerWalletCurrency('CAD');
      mockTx.referral.updateMany.mockResolvedValue({ count: 0 });

      await service.onTransferDelivered('referee-1', 'transfer-1');

      expect(ledger.post).not.toHaveBeenCalled();
    });

    it('is a no-op when referee was not referred', async () => {
      givenReferrerWalletCurrency('CAD');
      mockTx.referral.updateMany.mockResolvedValue({ count: 0 });

      await service.onTransferDelivered('no-referral-user', 'transfer-1');

      expect(ledger.post).not.toHaveBeenCalled();
    });

    it('skips credit if referrer is suspended', async () => {
      givenReferrerWalletCurrency('CAD');
      mockTx.referral.updateMany.mockResolvedValue({ count: 1 });
      mockTx.referral.findUnique.mockResolvedValueOnce({
        id: 'ref-1',
        referrerId: 'referrer-1',
        refereeId: 'referee-1',
        referrer: { id: 'referrer-1', suspended: true },
      });

      await service.onTransferDelivered('referee-1', 'transfer-1');

      expect(ledger.post).not.toHaveBeenCalled();
    });
  });

  describe('checkCode', () => {
    it('returns true for a valid code', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      expect(await service.checkCode('VALID123')).toBe(true);
    });

    it('returns false for an invalid code', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      expect(await service.checkCode('INVALID')).toBe(false);
    });
  });
});
