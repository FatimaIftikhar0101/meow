import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = () => ({
  session: {
    findUnique: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({}),
  },
});

function makeStrategy(prisma: ReturnType<typeof mockPrisma>): JwtStrategy {
  const config = {
    get: (key: string) => (key === 'JWT_SECRET' ? 'test-secret' : undefined),
  } as unknown as ConfigService;
  return new JwtStrategy(config, prisma as unknown as PrismaService);
}

describe('JwtStrategy', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = mockPrisma();
    strategy = makeStrategy(prisma);
  });

  const basePayload: JwtPayload = {
    sub: 'u-1',
    email: 'test@test.com',
    role: 'customer',
    sid: 'sess-1',
    iat: Math.floor(Date.now() / 1000),
  };

  it('accepts an active session and returns the user', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      lastSeenAt: new Date(),
      user: {
        id: 'u-1',
        email: 'test@test.com',
        role: 'customer',
        suspended: false,
        passwordChangedAt: new Date(0),
      },
    });

    const result = await strategy.validate(basePayload);

    expect(result).toEqual({
      id: 'u-1',
      email: 'test@test.com',
      role: 'customer',
      sid: 'sess-1',
      mfaEnabled: false,
    });
  });

  it('rejects a token with no sid', async () => {
    const payload = { ...basePayload, sid: '' };
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a revoked session', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      lastSeenAt: new Date(),
      user: {
        id: 'u-1',
        email: 'test@test.com',
        role: 'customer',
        suspended: false,
        passwordChangedAt: new Date(0),
      },
    });

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired session', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      lastSeenAt: new Date(),
      user: {
        id: 'u-1',
        email: 'test@test.com',
        role: 'customer',
        suspended: false,
        passwordChangedAt: new Date(0),
      },
    });

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing session', async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a suspended user', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      lastSeenAt: new Date(),
      user: {
        id: 'u-1',
        email: 'test@test.com',
        role: 'customer',
        suspended: true,
        passwordChangedAt: new Date(0),
      },
    });

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects token issued before password change', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      lastSeenAt: new Date(),
      user: {
        id: 'u-1',
        email: 'test@test.com',
        role: 'customer',
        suspended: false,
        passwordChangedAt: new Date(),
      },
    });

    const payload = {
      ...basePayload,
      iat: Math.floor(Date.now() / 1000) - 3600,
    };
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
