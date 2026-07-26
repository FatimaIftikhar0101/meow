import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService, splitName } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ReferralsService } from '../referrals/referrals.service';

jest.mock('bcrypt');

const mockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  wallet: { create: jest.fn() },
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('test-jwt-token') } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '7d',
                ADMIN_EMAILS: 'admin@test.com',
              };
              return map[key];
            },
          },
        },
        { provide: MailService, useValue: { sendVerificationEmail: jest.fn().mockResolvedValue(undefined) } },
        { provide: ReferralsService, useValue: { attachReferral: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('creates user, wallet, session, and returns a JWT with sid', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      const createdUser = { id: 'u-1', email: 'test@test.com', role: 'customer' };
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({
          user: { create: jest.fn().mockResolvedValue(createdUser) },
          wallet: { create: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }),
      );
      prisma.session.create.mockResolvedValue({ id: 'sess-1' });

      const result = await service.register(
        { email: 'test@test.com', password: 'Password123', fullName: 'Ada Lovelace' } as any,
      );

      expect(result).toEqual({ access_token: 'test-jwt-token' });
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u-1' }),
      });
    });

    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ email: 'dup@test.com', password: 'Password123', fullName: 'Dup User' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('creates a session on successful login', async () => {
      const user = {
        id: 'u-1',
        email: 'test@test.com',
        passwordHash: 'hashed',
        suspended: false,
        role: 'customer',
      };
      prisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.auditLog.create.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({ id: 'sess-1' });

      const result = await service.login({ email: 'test@test.com', password: 'Password123' } as any);

      expect(result).toEqual({ access_token: 'test-jwt-token' });
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('rejects invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'test@test.com',
        passwordHash: 'hashed',
        role: 'customer',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('listSessions', () => {
    it('returns active sessions and flags the current one', async () => {
      prisma.session.findMany.mockResolvedValue([
        { id: 'sess-1', userAgent: 'Chrome', ipAddress: '1.2.3.4', lastSeenAt: new Date(), createdAt: new Date() },
        { id: 'sess-2', userAgent: 'Safari', ipAddress: '5.6.7.8', lastSeenAt: new Date(), createdAt: new Date() },
      ]);

      const result = await service.listSessions('u-1', 'sess-1');

      expect(result).toHaveLength(2);
      expect(result[0].current).toBe(true);
      expect(result[1].current).toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('sets revokedAt on the target session', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'sess-2',
        userId: 'u-1',
        revokedAt: null,
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({
          session: { update: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }),
      );

      const result = await service.revokeSession('u-1', 'sess-2');
      expect(result.message).toBe('Session revoked');
    });

    it('refuses to revoke another user\'s session', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'sess-2',
        userId: 'other-user',
        revokedAt: null,
      });

      await expect(service.revokeSession('u-1', 'sess-2')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('revokeOtherSessions', () => {
    it('revokes all sessions except current', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({
          session: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }),
      );

      const result = await service.revokeOtherSessions('u-1', 'sess-current');
      expect(result.message).toBe('All other sessions revoked');
    });
  });

  describe('changePassword', () => {
    it('revokes all sessions and creates a new one', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'test@test.com',
        passwordHash: 'old-hash',
        role: 'customer',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({
          user: {
            update: jest.fn().mockResolvedValue({
              id: 'u-1',
              email: 'test@test.com',
              role: 'customer',
            }),
          },
          session: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }),
      );
      prisma.session.create.mockResolvedValue({ id: 'new-sess' });

      const result = await service.changePassword(
        'u-1',
        { currentPassword: 'OldPass123', newPassword: 'NewPass456' } as any,
      );

      expect(result).toEqual({ access_token: 'test-jwt-token' });
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u-1' }),
      });
    });

    it('rejects when current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        passwordHash: 'old-hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('u-1', {
          currentPassword: 'wrong',
          newPassword: 'NewPass456',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

describe('splitName', () => {
  it('splits a two-part name into given name and the rest', () => {
    expect(splitName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
  });

  it('keeps every token after the first as the last name', () => {
    expect(splitName('Muhammad Farman Ali')).toEqual({
      firstName: 'Muhammad',
      lastName: 'Farman Ali',
    });
  });

  it('returns a null lastName for a single-token name rather than duplicating it', () => {
    expect(splitName('Prince')).toEqual({ firstName: 'Prince', lastName: null });
  });

  it('collapses runs of whitespace and trims', () => {
    expect(splitName('  Ada   Lovelace  ')).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });
});
