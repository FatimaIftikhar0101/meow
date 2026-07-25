import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ReferralsService } from './referrals.service';
import { PrismaService } from '../prisma/prisma.service';
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
    wallet: { findFirst: jest.fn() },
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

describe('ReferralsService', () => {
  let service: ReferralsService;
  let prisma: MockPrisma;
  let notifications: ReturnType<typeof mockNotifications>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockTx = prisma;
    notifications = mockNotifications();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: prisma },
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
    it('credits the referrer exactly once when transfer is delivered', async () => {
      mockTx.referral.updateMany.mockResolvedValue({ count: 1 });
      mockTx.referral.findUnique
        .mockResolvedValueOnce({
          id: 'ref-1',
          referrerId: 'referrer-1',
          refereeId: 'referee-1',
          status: 'rewarded',
          referrer: { id: 'referrer-1', suspended: false },
        })
        .mockResolvedValueOnce({
          referrerId: 'referrer-1',
          status: 'rewarded',
          id: 'ref-1',
        });
      mockTx.wallet.findFirst.mockResolvedValue({
        id: 'wallet-1',
        currency: 'CAD',
      });
      mockTx.$queryRaw.mockResolvedValue([]);
      mockTx.ledgerEntry.create.mockResolvedValue({});
      mockTx.auditLog.create.mockResolvedValue({});

      await service.onTransferDelivered('referee-1', 'transfer-1');

      expect(mockTx.referral.updateMany).toHaveBeenCalledWith({
        where: { refereeId: 'referee-1', status: 'pending' },
        data: expect.objectContaining({
          status: 'rewarded',
          qualifyingTransferId: 'transfer-1',
        }),
      });
      expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'credit',
          type: 'referral_bonus',
          amount: new Prisma.Decimal(15),
          currency: 'CAD',
        }),
      });
    });

    it('is a no-op on second call (idempotency)', async () => {
      mockTx.referral.updateMany.mockResolvedValue({ count: 0 });

      await service.onTransferDelivered('referee-1', 'transfer-1');

      expect(mockTx.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it('is a no-op when referee was not referred', async () => {
      mockTx.referral.updateMany.mockResolvedValue({ count: 0 });

      await service.onTransferDelivered('no-referral-user', 'transfer-1');

      expect(mockTx.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it('skips credit if referrer is suspended', async () => {
      mockTx.referral.updateMany.mockResolvedValue({ count: 1 });
      mockTx.referral.findUnique.mockResolvedValue({
        id: 'ref-1',
        referrerId: 'referrer-1',
        refereeId: 'referee-1',
        referrer: { id: 'referrer-1', suspended: true },
      });

      await service.onTransferDelivered('referee-1', 'transfer-1');

      expect(mockTx.ledgerEntry.create).not.toHaveBeenCalled();
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
