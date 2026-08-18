import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../decorators/current-user.decorator';
import { can, type Permission } from '../permissions';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Declare what a route needs to do its job.
 *
 *   @RequirePermission('transfer.refund')
 *
 * Routes ask for a capability, never for a role. Adding a role, or moving a
 * capability between roles, then touches `permissions.ts` alone.
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    // No declaration means no permission check here. Routes under a staff
    // controller are still behind JwtAuthGuard and whatever role gate the
    // controller carries; this guard only enforces what was asked for.
    if (!required) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!req.user || !can(req.user.role, required)) {
      // Deliberately says which permission is missing. This endpoint is only
      // reachable by an authenticated staff member, and "forbidden" with no
      // detail turns every access-control question into a support ticket.
      throw new ForbiddenException(`Requires permission: ${required}`);
    }
    return true;
  }
}
