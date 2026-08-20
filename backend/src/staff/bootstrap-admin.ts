import { PrismaClient, UserRole } from '@prisma/client';
import { codeExpiry, generateCode, hashCode } from '../auth/one-time-code';
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

export type BootstrapOutcome =
  | { kind: 'created'; email: string; setupCode: string }
  | { kind: 'promoted'; email: string; from: UserRole; setupCode?: string }
  | { kind: 'already-admin'; email: string };

export interface BootstrapArgs {
  email: string;
  reason: string;
  force: boolean;
}

export class BootstrapError extends Error {}

export async function bootstrapAdmin(
  prisma: PrismaClient,
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

  const setupCode = generateCode();
  const codeHash = await hashCode(setupCode);
  const expires = codeExpiry();

  if (!existing) {
    // The ordinary case on a fresh deployment: nobody has an account at all.
    // Create one the same way the panel creates any staff account — no password
    // set here, and the account proved by whoever holds the code. No wallet
    // either; staff hold no funds.
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          role: 'admin',
          pwResetToken: codeHash,
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

    // Printed by the caller, never emailed. This runs before anyone can sign
    // in, and often before mail is configured at all — making the first
    // administrator depend on a working mail provider would be a poor place to
    // discover it is not.
    return { kind: 'created', email, setupCode };
  }

  if (existing.suspended) {
    throw new BootstrapError(`${email} is suspended.`);
  }
  if (existing.role === 'admin') {
    return { kind: 'already-admin', email };
  }

  // The account already exists — someone registered first, or an earlier run
  // created it. Promote rather than duplicate, and only issue a code when there
  // is no verified address behind an existing password. Someone who can already
  // sign in does not need a second way to.
  const needsCode = !existing.emailVerified;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.id },
      data: needsCode
        ? {
            role: 'admin',
            pwResetToken: codeHash,
            pwResetExpires: expires,
            pwResetAttempts: 0,
          }
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

  return {
    kind: 'promoted',
    email,
    from: existing.role,
    ...(needsCode ? { setupCode } : {}),
  };
}
