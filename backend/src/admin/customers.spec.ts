import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CustomersService } from './customers.service';
import { encryptField, maskAccount } from '../common/crypto/field-crypto';
import { resetEncryptionKeyCache } from '../common/crypto/field-crypto';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

/**
 * Customer 360, and the one route on it that reaches PII.
 *
 * The aggregate is mostly assembly, and assembly is not where the risk is. Two
 * properties are, and they are the ones pinned down here.
 *
 * **Nothing on the overview is a full account number.** The screen support has
 * open all day must not carry one. That is easy to hold today and easy to lose
 * the next time a field is added to the select, which is exactly why it is a
 * test and not a convention.
 *
 * **A reveal cannot happen unaudited, and cannot happen across customers.**
 * Passing a customer id you may view together with a recipient id belonging to
 * someone else would otherwise produce an audit row naming the wrong person —
 * worse than none, because it reads as evidence. And if the audit write fails,
 * no value comes back.
 */

const STAFF: AuthUser = {
  id: 'staff-1',
  email: 'compliance@meow.test',
} as AuthUser;

const ACCOUNT = 'PK36SCBL0000001123456702';

/** The row shape `writeStaffAudit` hands to Prisma. Named here so the
 *  assertions below read against a type rather than `any` off a jest mock. */
interface AuditRow {
  action: string;
  entityType: string | null;
  entityId: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
}

function createMockPrisma() {
  return {
    user: { findUnique: jest.fn() },
    transfer: { findMany: jest.fn(), findFirst: jest.fn() },
    recipient: { findFirst: jest.fn() },
    session: { findMany: jest.fn() },
    notification: { findMany: jest.fn() },
    referral: { findMany: jest.fn() },
    customerNote: { findMany: jest.fn(), create: jest.fn() },
    // Typed rather than a bare jest.fn(), so the assertions below read the
    // audit row through a type instead of `any`.
    auditLog: {
      create: jest.fn() as jest.Mock<Promise<unknown>, [{ data: AuditRow }]>,
    },
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

function auditRow(prisma: MockPrisma, call = 0): AuditRow {
  return prisma.auditLog.create.mock.calls[call][0].data;
}

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: MockPrisma;
  let stored: string;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    resetEncryptionKeyCache();
    stored = encryptField(ACCOUNT);
  });

  beforeEach(async () => {
    prisma = createMockPrisma();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: WalletService,
          useValue: {
            computeBalance: jest
              .fn()
              .mockResolvedValue(new Prisma.Decimal('120.50')),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(CustomersService);
  });

  describe('overview', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'c-1',
        email: 'customer@meow.test',
        firstName: 'Ayesha',
        lastName: 'Khan',
        country: 'CA',
        role: 'customer',
        suspended: false,
        emailVerified: true,
        authProvider: 'local',
        referralCode: 'MEOW-1234',
        createdAt: new Date('2026-01-01'),
        ledgerAccounts: [{ id: 'w-1', currency: 'CAD' }],
        kycRecords: [],
        referredBy: null,
        _count: { transfers: 3, recipients: 2, referralsMade: 1 },
      });
      prisma.transfer.findMany.mockResolvedValue([
        {
          id: 't-1',
          status: 'delivered',
          sendAmount: new Prisma.Decimal('250.00'),
          sendCurrency: 'CAD',
          receiveAmount: new Prisma.Decimal('49500.00'),
          receiveCurrency: 'PKR',
          feeAmount: new Prisma.Decimal('4.99'),
          fxRateApplied: new Prisma.Decimal('198.0'),
          createdAt: new Date('2026-02-01'),
          updatedAt: new Date('2026-02-01'),
          failureReason: null,
          recipientName: 'Ayesha Khan',
          recipientCountry: 'PK',
          recipientBankName: 'Standard Chartered',
          recipientBankAccount: stored,
        },
      ]);
      prisma.session.findMany.mockResolvedValue([]);
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.referral.findMany.mockResolvedValue([]);
      prisma.customerNote.findMany.mockResolvedValue([]);
    });

    it('masks the account number and does not carry the full one anywhere', async () => {
      const result = await service.overview('c-1');

      expect(result.transfers[0].recipientBankAccountMasked).toBe(
        maskAccount(ACCOUNT),
      );
      // The real assertion: the whole payload, not just the field we renamed.
      // A future `select` that adds `recipientBankAccount` back would pass the
      // check above and fail this one.
      expect(JSON.stringify(result)).not.toContain(ACCOUNT);
      // Nor the ciphertext, which looks like an answer and is not one.
      expect(JSON.stringify(result)).not.toContain(stored);
    });

    it('reports balances, counts and the referral state together', async () => {
      const result = await service.overview('c-1');
      expect(result.balances).toEqual([
        { accountId: 'w-1', currency: 'CAD', balance: '120.50' },
      ]);
      expect(result.profile.transferCount).toBe(3);
      expect(result.profile.recipientCount).toBe(2);
      expect(result.referrals).toEqual({ referredBy: null, made: [] });
    });

    it('survives one unreadable row rather than failing the page', async () => {
      prisma.transfer.findMany.mockResolvedValue([
        {
          id: 't-bad',
          status: 'delivered',
          sendAmount: new Prisma.Decimal('1'),
          sendCurrency: 'CAD',
          receiveAmount: null,
          receiveCurrency: 'PKR',
          feeAmount: new Prisma.Decimal('0'),
          fxRateApplied: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          failureReason: null,
          recipientName: 'X',
          recipientCountry: 'PK',
          recipientBankName: null,
          // Well-formed prefix, wrong contents: authentication fails.
          recipientBankAccount: 'v1.AAAA.BBBB.CCCC',
        },
      ]);
      const result = await service.overview('c-1');
      expect(result.transfers[0].recipientBankAccountMasked).toBe(
        '[unreadable]',
      );
    });

    it('loses one card rather than the page when a section fails', async () => {
      // Exactly the production failure this was found by: the CustomerNote
      // table did not exist, and the whole customer went blank.
      prisma.customerNote.findMany.mockRejectedValue(
        new Error('The table `public.CustomerNote` does not exist'),
      );

      const result = await service.overview('c-1');

      // The page still answers the question it exists for.
      expect(result.profile.email).toBe('customer@meow.test');
      expect(result.transfers).toHaveLength(1);
      expect(result.balances).toHaveLength(1);
      // And it says which part it could not read, rather than reporting an
      // empty list as though that were the answer.
      expect(result.degraded).toEqual(['notes']);
      expect(result.notes).toEqual([]);
    });

    it('reports a healthy page as not degraded', async () => {
      const result = await service.overview('c-1');
      expect(result.degraded).toEqual([]);
    });

    it('still fails the page when the transfers themselves cannot be read', async () => {
      // Not wrapped, deliberately. A customer 360 that cannot list transfers
      // is not a degraded page, it is a broken one, and showing it as though
      // the customer had never sent money would be a lie with consequences.
      prisma.transfer.findMany.mockRejectedValue(new Error('connection lost'));
      await expect(service.overview('c-1')).rejects.toThrow('connection lost');
    });

    it('404s an id that is not a customer', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.overview('nobody')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reveal', () => {
    it('returns the full number and writes an audit row carrying the reason', async () => {
      prisma.recipient.findFirst.mockResolvedValue({
        id: 'r-1',
        bankAccount: stored,
        name: 'Ayesha Khan',
      });

      const result = await service.reveal(STAFF, 'c-1', {
        recipientId: 'r-1',
        reason: 'Customer disputes the destination account',
      });

      expect(result.bankAccount).toBe(ACCOUNT);
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      const entry = auditRow(prisma);
      expect(entry.action).toBe('admin.customer.pii_reveal');
      expect(entry.entityType).toBe('Recipient');
      expect(entry.entityId).toBe('r-1');
      expect(entry.reason).toBe('Customer disputes the destination account');
      // The log records that visibility changed — and stores the masked form,
      // never the number itself. An audit trail that copies the secret into a
      // second table has moved the problem, not solved it.
      expect(JSON.stringify(entry)).not.toContain(ACCOUNT);
    });

    it('scopes the lookup to the customer named in the path', async () => {
      prisma.recipient.findFirst.mockResolvedValue(null);
      await expect(
        service.reveal(STAFF, 'c-1', {
          recipientId: 'belongs-to-someone-else',
          reason: 'fishing',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      // The ownership check is the `where`, so assert on it directly.
      expect(prisma.recipient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'belongs-to-someone-else', userId: 'c-1' },
        }),
      );
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('returns nothing if the audit write fails', async () => {
      prisma.recipient.findFirst.mockResolvedValue({
        id: 'r-1',
        bankAccount: stored,
        name: 'Ayesha Khan',
      });
      prisma.auditLog.create.mockRejectedValue(new Error('audit table down'));

      await expect(
        service.reveal(STAFF, 'c-1', {
          recipientId: 'r-1',
          reason: 'valid reason',
        }),
      ).rejects.toThrow('audit table down');
    });

    it('refuses a request naming both a recipient and a transfer', async () => {
      await expect(
        service.reveal(STAFF, 'c-1', {
          recipientId: 'r-1',
          transferId: 't-1',
          reason: 'valid reason',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('refuses a request naming neither', async () => {
      await expect(
        service.reveal(STAFF, 'c-1', { reason: 'valid reason' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reveals from a transfer snapshot, not the live recipient', async () => {
      prisma.transfer.findFirst.mockResolvedValue({
        id: 't-1',
        recipientBankAccount: stored,
        recipientName: 'Ayesha Khan',
      });

      const result = await service.reveal(STAFF, 'c-1', {
        transferId: 't-1',
        reason: 'Beneficiary bank returned the payment',
      });

      expect(result.bankAccount).toBe(ACCOUNT);
      expect(result.entityType).toBe('Transfer');
      // The snapshot column, because the question is where this transfer sent
      // money — not where the recipient's details point today.
      expect(prisma.transfer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            recipientBankAccount: true,
          }) as unknown,
        }),
      );
    });
  });

  describe('notes', () => {
    it('records the author from the session, not the request body', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'c-1' });
      prisma.customerNote.create.mockResolvedValue({ id: 'n-1' });

      await service.addNote(STAFF, 'c-1', 'Customer called about a delay');

      expect(prisma.customerNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            customerId: 'c-1',
            authorId: 'staff-1',
            body: 'Customer called about a delay',
          },
        }),
      );
    });

    it('404s a note against a customer that does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.addNote(STAFF, 'ghost', 'note'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.customerNote.create).not.toHaveBeenCalled();
    });
  });
});
