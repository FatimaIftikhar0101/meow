/**
 * Appoint the first administrator.
 *
 * Someone has to be first, and there is nobody inside the system to appoint
 * them — so it happens outside it, deliberately, by whoever holds deploy
 * access:
 *
 *   railway run npm run staff:bootstrap -- someone@example.com
 *
 * Every administrator after this one is invited through the panel, where the
 * grant is attributable to a person. This script exists only to break that
 * circle, so it refuses to run once an administrator exists.
 *
 * It replaces ADMIN_EMAILS, which was consulted on registration, on Google
 * sign-up and on every single login. That made an environment variable an
 * invisible second source of truth: it silently undid demotions made in the
 * panel, it only ever promoted (removing an address revoked nothing), and
 * because login never checked email verification, anyone who registered with a
 * listed address became an administrator without proving they could read that
 * inbox. A privilege grant should be a deliberate act with a record, not a
 * side effect of authenticating.
 *
 * The account must already exist and have a verified email. Register through
 * the normal flow first — that verification is the proof of inbox control that
 * the old mechanism never required.
 */
import { writeAudit } from '../src/common/audit/audit';
import { scriptPrisma } from './script-db';

const prisma = scriptPrisma();

interface Args {
  email: string;
  reason: string;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const rest = argv.slice(2);
  const force = rest.includes('--force');
  const reasonArg = rest.find((a) => a.startsWith('--reason='));
  const email = rest.find((a) => !a.startsWith('--'));

  if (!email) {
    throw new Error(
      'Usage: npm run staff:bootstrap -- <email> [--reason="..."] [--force]',
    );
  }
  return {
    email: email.trim().toLowerCase(),
    reason:
      reasonArg?.slice('--reason='.length) || 'Initial administrator bootstrap',
    force,
  };
}

async function main() {
  const args = parseArgs(process.argv);

  const existingAdmins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { email: true },
  });

  if (existingAdmins.length > 0 && !args.force) {
    // Not an error the caller should route around casually. If this fires, the
    // circle is already broken and the panel is the correct way in — a second
    // administrator granted here would have no human attributable to it.
    throw new Error(
      `${existingAdmins.length} administrator(s) already exist ` +
        `(${existingAdmins.map((a) => a.email).join(', ')}). ` +
        'Grant further roles through the panel, where the change is attributed ' +
        'to whoever made it. Pass --force only to recover from lost access.',
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: args.email },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      suspended: true,
    },
  });

  if (!user) {
    throw new Error(
      `No account for ${args.email}. Register through the app first, verify ` +
        'the address, then run this again.',
    );
  }
  if (!user.emailVerified) {
    throw new Error(
      `${args.email} has not verified its email address. That verification is ` +
        'the only proof the person holds the inbox; promote nothing without it.',
    );
  }
  if (user.suspended) {
    throw new Error(`${args.email} is suspended.`);
  }
  if (user.role === 'admin') {
    console.log(`${args.email} is already an administrator. Nothing to do.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role: 'admin' } });
    await writeAudit(tx, {
      // No actor id: this was run from a shell, not by a signed-in user. The
      // audit trail should say so plainly rather than attribute it to the
      // person being promoted, which would read as a self-grant.
      actor: { id: null, email: 'system:bootstrap' },
      action: 'staff.role.bootstrap',
      entityType: 'user',
      entityId: user.id,
      before: { role: user.role },
      after: { role: 'admin' },
      reason: args.reason,
      metadata: args.force ? { force: true, displacedNone: false } : null,
    });
  });

  console.log(`${args.email}: ${user.role} -> admin`);
  console.log('Every further role should be granted through the panel.');
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
