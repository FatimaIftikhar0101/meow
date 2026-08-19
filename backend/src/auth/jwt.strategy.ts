import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  sid: string; // session id
  /** Present only on the short-lived challenge issued between a staff
   *  password check and its code. Never valid as an access token. */
  typ?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      // Env validation should have rejected boot already, but belt-and-braces:
      // never let a hard-coded fallback ship with real credentials.
      throw new Error('JWT_SECRET must be set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // A challenge token carries no session id, so the check below would reject
    // it anyway. Named explicitly because "half-authenticated credential must
    // not work as a whole one" is too important to rest on a side effect.
    if (payload.typ && payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid token');
    }
    if (!payload.sid) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            suspended: true,
            passwordChangedAt: true,
            mfaEnabledAt: true,
          },
        },
      },
    });
    if (!session) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }
    if (session.revokedAt) {
      throw new UnauthorizedException('Session revoked, please sign in again');
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }

    const user = session.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.suspended) {
      throw new ForbiddenException('Account suspended');
    }
    if (payload.iat) {
      const passwordChangedAtSec = Math.floor(
        user.passwordChangedAt.getTime() / 1000,
      );
      if (payload.iat < passwordChangedAtSec) {
        throw new UnauthorizedException('Session ended, please sign in again');
      }
    }

    // Best-effort lastSeenAt update (throttled to ~5 min)
    const fiveMin = 5 * 60 * 1000;
    if (Date.now() - session.lastSeenAt.getTime() > fiveMin) {
      this.prisma.session
        .updateMany({
          where: { id: session.id },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => {});
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      sid: session.id,
      mfaEnabled: Boolean(user.mfaEnabledAt),
    };
  }
}
