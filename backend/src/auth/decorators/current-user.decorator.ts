import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  sid: string;
  /** Whether two-factor enrolment is complete. Staff routes require it; the
   *  enrolment endpoints are the only thing reachable without it. */
  mfaEnabled: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!req.user) {
      throw new Error('CurrentUser used outside an authenticated route');
    }
    return req.user;
  },
);
