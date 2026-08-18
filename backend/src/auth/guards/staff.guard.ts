import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../decorators/current-user.decorator';
import { isStaff } from '../permissions';

/**
 * The door to the back office.
 *
 * Coarse on purpose: it answers "is this a member of staff at all", and
 * nothing more. What any given staff member may actually *do* is decided
 * per-route by `PermissionsGuard`, so this guard never needs changing when a
 * role is added or a capability moves between roles.
 *
 * `AdminGuard` still exists for the few routes that really are administrator
 * only — staff management and role assignment — where the answer is not a
 * capability but a rank.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!req.user || !isStaff(req.user.role)) {
      throw new ForbiddenException('Staff access required');
    }
    return true;
  }
}
