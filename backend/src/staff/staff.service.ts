import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { isStaff, permissionsFor, STAFF_ROLES } from '../auth/permissions';
import { writeStaffAudit } from '../common/audit/audit';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

/** An invite is a standing grant of back-office access until it is claimed, so
 *  it should not sit unused in an inbox indefinitely. */
const INVITE_TOKEN_BYTES = 32;
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

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
   * Create a back-office account and email its owner a link to claim it.
   *
   * No password is set here and none is ever transmitted. The invitee follows
   * the existing reset-password flow, which both sets their password and marks
   * the address verified — so claiming the invite *is* the proof that they hold
   * the inbox it was sent to.
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

    const token = crypto.randomBytes(INVITE_TOKEN_BYTES).toString('hex');
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          role: input.role,
          firstName: input.firstName?.trim() || null,
          lastName: input.lastName?.trim() || null,
          // No wallet, unlike a customer registration: staff hold no funds
          // here, and the customer endpoints refuse a staff role anyway.
          pwResetToken: token,
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

    await this.mail.sendPasswordResetEmail(user.email, token);
    return { id: user.id, email: user.email, role: user.role, pending: true };
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
