import { PrismaClient } from '@prisma/client';
import { BootstrapError, bootstrapAdmin } from './bootstrap-admin';

const mockPrisma = () => ({
  user: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
});

const ARGS = {
  email: 'Boss@Company.com',
  reason: 'Handover to the client',
  force: false,
};

describe('bootstrapAdmin', () => {
  let prisma: ReturnType<typeof mockPrisma>;

  const run = (over: Partial<typeof ARGS> = {}) =>
    bootstrapAdmin(prisma as unknown as PrismaClient, { ...ARGS, ...over });

  beforeEach(() => {
    prisma = mockPrisma();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => fn(prisma),
    );
  });

  describe('on an empty database', () => {
    beforeEach(() => {
      prisma.user.create.mockResolvedValue({
        id: 'u-1',
        email: 'boss@company.com',
      });
    });

    it('creates the account outright, with no password', async () => {
      // The case that matters at handover: nobody has registered, so there is
      // nothing to promote. Requiring an existing account would have forced the
      // first administrator to sign up as a customer first.
      const result = await run();

      expect(result).toMatchObject({
        kind: 'created',
        email: 'boss@company.com',
      });

      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.role).toBe('admin');
      expect(data.passwordHash).toBeUndefined();
      // Lower-cased, or they could never sign in with what they were told.
      expect(data.email).toBe('boss@company.com');
      expect(data.pwResetExpires.getTime()).toBeGreaterThan(Date.now());
    });

    it('returns a six-digit code and stores only its hash', async () => {
      const result = await run();

      if (result.kind !== 'created') throw new Error('expected created');
      expect(result.setupCode).toMatch(/^\d{6}$/);

      const stored = prisma.user.create.mock.calls[0][0].data.pwResetToken;
      expect(stored).toMatch(/^\$2[aby]\$/);
      // Nothing can read the code back out of the database later; this
      // response is the only place it exists in the clear.
      await expect(
        require('bcrypt').compare(result.setupCode, stored),
      ).resolves.toBe(true);
    });

    it('sends no email at all', async () => {
      // The point of the whole design: bootstrap runs before mail is
      // necessarily configured, so it must not depend on it.
      await run();
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('records the grant against the shell, not the person receiving it', async () => {
      await run();

      const audit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(audit.action).toBe('staff.bootstrap.create');
      expect(audit.actorEmail).toBe('system:bootstrap');
      // Attributing it to the new administrator would read as a self-grant.
      expect(audit.userId).toBeNull();
      expect(audit.reason).toBe('Handover to the client');
      expect(audit.afterValue).toMatchObject({ role: 'admin' });
    });
  });

  describe('once an administrator exists', () => {
    beforeEach(() => {
      prisma.user.findMany.mockResolvedValue([{ email: 'first@company.com' }]);
    });

    it('refuses to run again', async () => {
      await expect(run()).rejects.toThrow(BootstrapError);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('names who already holds it, so the message is actionable', async () => {
      await expect(run()).rejects.toThrow(/first@company\.com/);
    });

    it('still runs under --force, for lost access', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'u-2',
        email: 'boss@company.com',
      });
      await expect(run({ force: true })).resolves.toMatchObject({
        kind: 'created',
      });
    });
  });

  describe('when the account already exists', () => {
    it('promotes a verified customer without issuing a new code', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-3',
        email: 'boss@company.com',
        role: 'customer',
        emailVerified: true,
        suspended: false,
      });

      const result = await run();

      expect(result).toEqual({
        kind: 'promoted',
        email: 'boss@company.com',
        from: 'customer',
      });
      // Their own password still works, so a second way in would be a spare
      // credential for no reason.
      expect(result).not.toHaveProperty('setupCode');
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({
        role: 'admin',
      });
    });

    it('issues a code when the address was never verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-4',
        email: 'boss@company.com',
        role: 'customer',
        emailVerified: false,
        suspended: false,
      });

      const result = await run();

      if (result.kind !== 'promoted') throw new Error('expected promoted');
      expect(result.setupCode).toMatch(/^\d{6}$/);
      expect(prisma.user.update.mock.calls[0][0].data.pwResetAttempts).toBe(0);
    });

    it('is a no-op when they are already an administrator', async () => {
      prisma.user.findMany.mockResolvedValue([{ email: 'boss@company.com' }]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-5',
        email: 'boss@company.com',
        role: 'admin',
        emailVerified: true,
        suspended: false,
      });

      await expect(run({ force: true })).resolves.toEqual({
        kind: 'already-admin',
        email: 'boss@company.com',
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses a suspended account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-6',
        email: 'boss@company.com',
        role: 'customer',
        emailVerified: true,
        suspended: true,
      });
      await expect(run()).rejects.toThrow(BootstrapError);
    });
  });
});
