import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService, splitName } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ReferralsService } from '../referrals/referrals.service';

jest.mock('bcrypt');

/**
 * Stands in for Google's key-fetching verifier. The real one makes a network
 * call to fetch signing certificates, which a unit test must not do; what is
 * under test here is what the service does with a verified payload, and that
 * it refuses everything else.
 */
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  })),
}));

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
                GOOGLE_CLIENT_ID: 'web-client-id.apps.googleusercontent.com',
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

  /**
   * ADMIN_EMAILS used to grant the admin role from three places: registration,
   * Google sign-up, and every single login. Nothing tested it, which is how it
   * survived long enough to become the way in.
   *
   * The config mock above still sets ADMIN_EMAILS, deliberately — these assert
   * that the variable is present and ignored, not merely absent.
   */
  describe('ADMIN_EMAILS grants nothing', () => {
    it('registers a listed address as a customer', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      const create = jest.fn().mockResolvedValue({
        id: 'u-1',
        email: 'admin@test.com',
        role: 'customer',
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({
          user: { create },
          wallet: { create: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }),
      );
      prisma.session.create.mockResolvedValue({ id: 'sess-1' });

      await service.register({
        email: 'admin@test.com',
        password: 'Password123',
        fullName: 'Ada Lovelace',
      } as any);

      // Not 'customer' explicitly — the column is simply never written, so the
      // schema default decides. Passing any role here would be the bug.
      expect(create.mock.calls[0][0].data.role).toBeUndefined();
    });

    it('does not rewrite the role on login', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'admin@test.com',
        passwordHash: 'hashed',
        suspended: false,
        emailVerified: true,
        role: 'customer',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.auditLog.create.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({ id: 'sess-1' });

      await service.login({ email: 'admin@test.com', password: 'Password123' } as any);

      // A demotion made in the panel used to be undone right here.
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('staff sign-in', () => {
    const staffUser = {
      id: 'u-2',
      email: 'analyst@meow.test',
      passwordHash: 'hashed',
      suspended: false,
      role: 'compliance',
    };

    it('refuses a staff account whose address is not verified', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...staffUser, emailVerified: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: staffUser.email, password: 'Password123' } as any, 'staff'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('admits a verified staff account', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...staffUser, emailVerified: true });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.auditLog.create.mockResolvedValue({});
      prisma.session.create.mockResolvedValue({ id: 'sess-1' });

      await expect(
        service.login({ email: staffUser.email, password: 'Password123' } as any, 'staff'),
      ).resolves.toEqual({ access_token: 'test-jwt-token' });
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

  describe('googleNativeLogin', () => {
    const payload = {
      sub: 'google-123',
      email: 'Native@Test.com',
      email_verified: true,
      given_name: 'Ayesha',
      picture: 'https://example.com/a.png',
    };

    beforeEach(() => {
      mockVerifyIdToken.mockReset();
      prisma.auditLog.create.mockResolvedValue({});
    });

    const validToken = 'x'.repeat(200);

    it('verifies the token and hands off to the shared googleLogin path', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-9',
        email: 'native@test.com',
        role: 'customer',
        suspended: false,
      });
      prisma.session.create.mockResolvedValue({ id: 'sess-9' });

      const result = await service.googleNativeLogin(validToken, { ip: '1.2.3.4' });

      expect(result).toEqual({ access_token: 'test-jwt-token' });
      // The audience must be the web client ID — that is what the ID token
      // minted by the native SDK carries as `aud`.
      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: validToken,
        audience: 'web-client-id.apps.googleusercontent.com',
      });
      // Reached googleLogin, which is what creates the session.
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('normalises the email before looking the account up', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({
          user: { create: jest.fn().mockResolvedValue({ id: 'u-10', email: 'native@test.com', role: 'customer', suspended: false }) },
          wallet: { create: jest.fn() },
          auditLog: { create: jest.fn() },
        }),
      );
      prisma.session.create.mockResolvedValue({ id: 'sess-10' });

      await service.googleNativeLogin(validToken);

      // Second lookup is by email, after the googleId lookup misses.
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'native@test.com' },
      });
    });

    it('rejects a token that fails verification', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid signature'));

      await expect(service.googleNativeLogin(validToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('rejects a token whose email Google has not verified', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ ...payload, email_verified: false }),
      });

      await expect(service.googleNativeLogin(validToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('rejects a payload with no subject', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ email: 'a@b.com' }) });

      await expect(service.googleNativeLogin(validToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('refuses a suspended account, same as every other sign-in path', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-9',
        email: 'native@test.com',
        role: 'customer',
        suspended: true,
      });

      await expect(service.googleNativeLogin(validToken)).rejects.toThrow(
        ForbiddenException,
      );
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
