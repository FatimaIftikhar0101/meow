import { PrismaClient, UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import { writeAudit } from '../common/audit/audit';

/**
 * Appoint the first administrator.
 *
 * Lives here rather than in the script that calls it so it can be tested. The
 * script is the wiring — a database connection, a mail transport, some
 * printing — and this is the decision it makes.
 *
 * There is nobody inside the system to appoint the first administrator, so it
 * happens from outside, once. Everyone after them is invited from the panel,
 * where the grant is attributable to a person; hence the refusal to run again.
 */

const INVITE_TOKEN_BYTES = 32;
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/** Emails the setup link. Injected so a test does not send anything. */
export type SendInvite = (email: string, token: string) => Promise<void>;

export type BootstrapOutcome =
  | { kind: 'created'; email: string }
  | { kind: 'promoted'; email: string; from: UserRole; invited: boolean }
  | { kind: 'already-admin'; email: string };

export interface BootstrapArgs {
  email: string;
  reason: string;
  force: boolean;
}

export class BootstrapError extends Error {}

export async function bootstrapAdmin(
  prisma: PrismaClient,
  sendInvite: SendInvite,
  args: BootstrapArgs,
): Promise<BootstrapOutcome> {
  const email = args.email.trim().toLowerCase();

  const existingAdmins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { email: true },
  });
  if (existingAdmins.length > 0 && !args.force) {
    throw new BootstrapError(
      `${existingAdmins.length} administrator(s) already exist ` +
        `(${existingAdmins.map((a) => a.email).join(', ')}). ` +
        'Invite further staff from the panel. Pass --force only to recover ' +
        'from lost access.',
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      suspended: true,
    },
  });

  const token = crypto.randomBytes(INVITE_TOKEN_BYTES).toString('hex');
  const expires = new Date(Date.now() + INVITE_TTL_MS);

  if (!existing) {
    // The ordinary case on a fresh deployment: nobody has an account at all.
    // Create one the same way the panel creates any staff account — no
    // password set here, none emailed, and the address proves itself by
    // claiming the link. No wallet either; staff hold no funds.
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          role: 'admin',
          pwResetToken: token,
          pwResetExpires: expires,
        },
      });
      await writeAudit(tx, {
        // No actor id: run from a shell, not by a signed-in user.
        actor: { id: null, email: 'system:bootstrap' },
        action: 'staff.bootstrap.create',
        entityType: 'user',
        entityId: user.id,
        before: null,
        after: { email, role: 'admin' },
        reason: args.reason,
      });
      return user;
    });

    // After the commit, not inside it: a mail provider that hangs must not
    // hold a database transaction open, and a send that fails must not roll
    // back an administrator who now exists.
    await sendInvite(created.email, token);
    return { kind: 'created', email };
  }

  if (existing.suspended) {
    throw new BootstrapError(`${email} is suspended.`);
  }
  if (existing.role === 'admin') {
    return { kind: 'already-admin', email };
  }

  // The account already exists — someone registered first, or an earlier run
  // created it. Promote rather than duplicate. Only re-issue a setup link when
  // there is no verified address to reset from; otherwise their own password
  // still works and a fresh link would be an unnecessary credential in an
  // inbox.
  const invited = !existing.emailVerified;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.id },
      data: invited
        ? { role: 'admin', pwResetToken: token, pwResetExpires: expires }
        : { role: 'admin' },
    });
    await writeAudit(tx, {
      // Attributing this to the person being promoted would read as a
      // self-grant, which is the one thing it must not look like.
      actor: { id: null, email: 'system:bootstrap' },
      action: 'staff.role.bootstrap',
      entityType: 'user',
      entityId: existing.id,
      before: { role: existing.role },
      after: { role: 'admin' },
      reason: args.reason,
    });
  });

  if (invited) await sendInvite(existing.email, token);
  return { kind: 'promoted', email, from: existing.role, invited };
}
