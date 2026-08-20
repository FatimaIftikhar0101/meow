import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { generateCode, hashCode } from '../auth/one-time-code';
import { isStaff, permissionsFor, STAFF_ROLES } from '../auth/permissions';
import { writeStaffAudit } from '../common/audit/audit';
import { PrismaService } from '../prisma/prisma.service';

/**
 * How long a setup code stays good.
 *
 * Longer than the fifteen minutes a password reset gets, because this one is
 * read out or messaged to a colleague rather than waiting in their inbox — the
 * clock starts when the admin creates it, not when the person sits down. Still
 * short enough that an unclaimed grant does not linger for days.
 */
const INVITE_TTL_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const staff = await this.prisma.user.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        suspended: true,
        emailVerified: true,
        passwordHash: true,
        createdAt: true,
      },
    });
    return staff.map(({ passwordHash, ...s }) => ({
      ...s,
      // Never the hash, only whether the invitation has been taken up. An
      // account with no password was invited and never claimed, which is worth
      // seeing in the list rather than discovering months later.
      pending: passwordHash === null,
      permissions: permissionsFor(s.role),
    }));
  }

  /**
   * Create a back-office account and hand its setup code back to the admin.
   *
   * The code is returned in the response and **not emailed**. Staff are hired,
   * not signed up: the person creating the account knows the person receiving
   * it and can pass six digits over directly. That removes email from the flow
   * where failure hurts most — this product has no domain, so mail is often
   * filtered, and a colleague blocked from the back office by a spam folder is
   * a bad way to start.
   *
   * It is also the safer shape. Nothing sits in an inbox waiting to be read,
   * forwarded, or fetched by a scanner, and the code is only ever seen by two
   * people who already work together.
   *
   * No password is set here and none is transmitted. Claiming the code both
   * sets the password and marks the address verified, so it is still the
   * invitee who proves the address is theirs.
   */
  async invite(
    actor: AuthUser,
    input: {
      email: string;
      role: UserRole;
      firstName?: string;
      lastName?: string;
      reason: string;
    },
  ) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Deliberately not an invitation. Turning an existing account into a
      // staff account is a role change against a known person, and it belongs
      // on the endpoint that records what the role was before.
      throw new ConflictException(
        isStaff(existing.role)
          ? 'That address already belongs to a staff account'
          : 'That address already has an account — change its role instead',
      );
    }

    const setupCode = generateCode();
    const codeHash = await hashCode(setupCode);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          role: input.role,
          firstName: input.firstName?.trim() || null,
          lastName: input.lastName?.trim() || null,
          // No wallet, unlike a customer registration: staff hold no funds
          // here, and the customer endpoints refuse a staff role anyway.
          pwResetToken: codeHash,
          pwResetExpires: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
      await writeStaffAudit(tx, {
        actor: { id: actor.id, email: actor.email },
        action: 'staff.invite',
        entityType: 'user',
        entityId: created.id,
        before: null,
        after: { email, role: input.role },
        reason: input.reason,
      });
      return created;
    });

    // Returned exactly once, to the admin who created the account. It is a
    // bcrypt hash from here on, so nothing can read it back out later.
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      pending: true,
      setupCode,
      expiresInMinutes: INVITE_TTL_MS / 60000,
    };
  }

  async assignRole(
    actor: AuthUser,
    targetId: string,
    role: UserRole,
    reason: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');

    // Nobody promotes themselves, and nobody demotes themselves either — the
    // second half matters because demoting yourself out of the only admin role
    // is how an organisation loses its back office.
    if (targetId === actor.id) {
      throw new ForbiddenException(
        'You cannot change your own role. Ask another administrator.',
      );
    }
    if (user.role === role) {
      throw new BadRequestException(`Already ${role}`);
    }
    if (user.role === 'admin') {
      await this.assertNotLastAdmin(targetId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: targetId }, data: { role } });
      // Sessions are deliberately left alone. JwtStrategy re-reads the role
      // from the database on every request, so the change is in force on the
      // very next call — revoking here would sign the person out for no added
      // safety.
      await writeStaffAudit(tx, {
        actor: { id: actor.id, email: actor.email },
        action: 'staff.role.assign',
        entityType: 'user',
        entityId: targetId,
        before: { role: user.role },
        after: { role },
        reason,
      });
    });
    return { id: targetId, role };
  }

  async setActive(
    actor: AuthUser,
    targetId: string,
    active: boolean,
    reason: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');
    if (!isStaff(user.role)) {
      throw new BadRequestException(
        'Not a staff account — use the customer suspension endpoint',
      );
    }
    if (targetId === actor.id) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    if (!active && user.role === 'admin') {
      await this.assertNotLastAdmin(targetId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetId },
        data: { suspended: !active },
      });
      if (!active) {
        // Unlike a role change, this must take effect immediately: the point of
        // deactivating someone is that they stop having access now, not when
        // their token happens to expire.
        await tx.session.updateMany({
          where: { userId: targetId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await writeStaffAudit(tx, {
        actor: { id: actor.id, email: actor.email },
        action: active ? 'staff.reactivate' : 'staff.deactivate',
        entityType: 'user',
        entityId: targetId,
        before: { suspended: user.suspended },
        after: { suspended: !active },
        reason,
      });
    });
    return { id: targetId, active };
  }

  /**
   * Refuse to remove the last way in.
   *
   * Counts only administrators who could actually sign in — a suspended one is
   * not a fallback. Recovering from this state needs shell access and the
   * bootstrap script, which is precisely the situation that should not be
   * reachable by clicking.
   */
  private async assertNotLastAdmin(excludingId: string) {
    const others = await this.prisma.user.count({
      where: { role: 'admin', suspended: false, id: { not: excludingId } },
    });
    if (others === 0) {
      throw new ForbiddenException(
        'This is the only active administrator. Appoint another one first.',
      );
    }
  }
}
