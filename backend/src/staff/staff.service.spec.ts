import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { StaffService } from './staff.service';

const mockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  session: { updateMany: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
});

const ADMIN: AuthUser = {
  id: 'actor-1',
  email: 'boss@meow.test',
  role: 'admin',
  sid: 'sid-1',
  mfaEnabled: true,
};

describe('StaffService', () => {
  let service: StaffService;
  let prisma: ReturnType<typeof mockPrisma>;
  let mail: { sendStaffSetupEmail: jest.Mock };

  beforeEach(async () => {
    prisma = mockPrisma();
    mail = { sendStaffSetupEmail: jest.fn().mockResolvedValue(undefined) };
    // Run the callback against the same mock, so audit writes inside a
    // transaction land on the spy the assertions read.
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => fn(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(StaffService);
  });

  describe('invite', () => {
    const input = {
      email: 'New.Analyst@Meow.test',
      role: 'compliance' as const,
      reason: 'Joining the AML team',
    };

    it('creates the account without a password and returns a setup code', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-9',
        email: 'new.analyst@meow.test',
        role: 'compliance',
      });

      const result = await service.invite(ADMIN, input);

      const created = prisma.user.create.mock.calls[0][0].data;
      expect(created.passwordHash).toBeUndefined();
      // Lower-cased, or the invitee could never log in with what they typed.
      expect(created.email).toBe('new.analyst@meow.test');
      expect(created.pwResetExpires.getTime()).toBeGreaterThan(Date.now());
      expect(result.pending).toBe(true);

      // Six digits, handed to the admin to pass on. Email is not in this flow
      // at all — a colleague blocked from the back office by a spam folder is
      // the failure this design exists to remove.
      expect(result.setupCode).toMatch(/^\d{6}$/);
    });

    it('stores only a hash of the code, never the code itself', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-9',
        email: 'new.analyst@meow.test',
        role: 'compliance',
      });

      const result = await service.invite(ADMIN, input);
      const stored = prisma.user.create.mock.calls[0][0].data.pwResetToken;

      expect(stored).toMatch(/^\$2[aby]\$/);
      expect(stored).not.toContain(result.setupCode);
      // The response is the only place it exists in the clear, once.
      await expect(
        require('bcrypt').compare(result.setupCode, stored),
      ).resolves.toBe(true);
    });

    it('records who granted the access and why', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-9',
        email: 'x',
        role: 'compliance',
      });

      await service.invite(ADMIN, input);

      const audit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(audit.action).toBe('staff.invite');
      expect(audit.actorEmail).toBe(ADMIN.email);
      expect(audit.reason).toBe('Joining the AML team');
      expect(audit.afterValue).toMatchObject({ role: 'compliance' });
    });

    it('does not email the code unless asked', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-9',
        email: 'new.analyst@meow.test',
        role: 'compliance',
      });

      const result = await service.invite(ADMIN, input);

      expect(mail.sendStaffSetupEmail).not.toHaveBeenCalled();
      expect(result.emailed).toBe(false);
    });

    it('emails the same code it returns, when asked', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-9',
        email: 'new.analyst@meow.test',
        role: 'compliance',
      });

      const result = await service.invite(ADMIN, {
        ...input,
        sendEmail: true,
      });

      // The lower-cased address, not what was typed — otherwise the mail goes
      // somewhere subtly different from the account that was created.
      expect(mail.sendStaffSetupEmail).toHaveBeenCalledWith(
        'new.analyst@meow.test',
        result.setupCode,
        result.expiresInMinutes,
      );
      expect(result.emailed).toBe(true);
    });

    it('still creates the account when the email fails', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-9',
        email: 'new.analyst@meow.test',
        role: 'compliance',
      });
      mail.sendStaffSetupEmail.mockRejectedValue(new Error('550 rejected'));

      // The account exists and the code is on the admin's screen. Throwing here
      // would report a failed invitation for a copy that was never the primary
      // way the code gets delivered.
      const result = await service.invite(ADMIN, {
        ...input,
        sendEmail: true,
      });

      expect(result.setupCode).toMatch(/^\d{6}$/);
      expect(result.emailed).toBe(false);
      expect(result.emailError).toContain('550 rejected');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('refuses an address that already has an account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'customer' });
      await expect(service.invite(ADMIN, input)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('assignRole', () => {
    it('refuses to let anyone change their own role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: ADMIN.id, role: 'admin' });
      await expect(
        service.assignRole(ADMIN, ADMIN.id, 'support', 'tidying up'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('records the previous role, not just the new one', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-2', role: 'support' });

      await service.assignRole(
        ADMIN,
        'u-2',
        'operations',
        'Moving to the payouts desk',
      );

      const audit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(audit.beforeValue).toEqual({ role: 'support' });
      expect(audit.afterValue).toEqual({ role: 'operations' });
      expect(audit.reason).toBe('Moving to the payouts desk');
    });

    it('leaves sessions alone, because the role is re-read per request', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-2', role: 'support' });
      await service.assignRole(ADMIN, 'u-2', 'compliance', 'promotion');
      expect(prisma.session.updateMany).not.toHaveBeenCalled();
    });

    it('will not demote the last active administrator', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-2', role: 'admin' });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.assignRole(ADMIN, 'u-2', 'support', 'stepping back'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('allows demoting an administrator when another one remains', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-2', role: 'admin' });
      prisma.user.count.mockResolvedValue(1);

      await expect(
        service.assignRole(ADMIN, 'u-2', 'support', 'stepping back'),
      ).resolves.toEqual({ id: 'u-2', role: 'support' });
    });

    it('rejects a no-op rather than writing an empty audit entry', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-2', role: 'support' });
      await expect(
        service.assignRole(ADMIN, 'u-2', 'support', 'no change'),
      ).rejects.toThrow(BadRequestException);
    });

    it('404s on an unknown target', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.assignRole(ADMIN, 'nope', 'support', 'x'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setActive', () => {
    it('revokes live sessions when deactivating', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-3',
        role: 'operations',
        suspended: false,
      });

      await service.setActive(ADMIN, 'u-3', false, 'Left the company');

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-3', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('does not revoke sessions when reactivating', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-3',
        role: 'operations',
        suspended: true,
      });
      await service.setActive(ADMIN, 'u-3', true, 'Returned from leave');
      expect(prisma.session.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a customer account, which belongs to the other endpoint', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-4',
        role: 'customer',
        suspended: false,
      });
      await expect(
        service.setActive(ADMIN, 'u-4', false, 'wrong door'),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses self-deactivation', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: ADMIN.id,
        role: 'admin',
        suspended: false,
      });
      await expect(
        service.setActive(ADMIN, ADMIN.id, false, 'locking myself out'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('will not deactivate the last active administrator', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-5',
        role: 'admin',
        suspended: false,
      });
      prisma.user.count.mockResolvedValue(0);
      await expect(
        service.setActive(ADMIN, 'u-5', false, 'cleanup'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('list', () => {
    it('reports an unclaimed invite without exposing the hash column', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'a', email: 'a@x', role: 'support', passwordHash: null },
        { id: 'b', email: 'b@x', role: 'admin', passwordHash: 'bcrypt-hash' },
      ]);

      const out = await service.list();

      expect(out[0].pending).toBe(true);
      expect(out[1].pending).toBe(false);
      expect(JSON.stringify(out)).not.toContain('bcrypt-hash');
      expect(out[0]).not.toHaveProperty('passwordHash');
      // The panel builds its navigation from this rather than from role names.
      expect(out[0].permissions).toContain('customer.read');
      expect(out[0].permissions).not.toContain('role.assign');
    });
  });
});
