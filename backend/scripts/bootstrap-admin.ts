/**
 * Appoint the first administrator.
 *
 *   railway run npm run staff:bootstrap -- someone@example.com
 *
 * That address is emailed a link to set a password and enrol in two-factor,
 * exactly like an invitation sent from the panel. From then on the panel is
 * the only way in: this administrator invites everyone else, and each of those
 * grants is attributable to a person. So this refuses to run a second time.
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
 * This file is only wiring — a database connection, a mail transport, some
 * printing. The decision it makes lives in src/staff/bootstrap-admin.ts, where
 * it is covered by tests.
 *
 * Needs the mail transport configured (RESEND_API_KEY, MAIL_FROM) so the link
 * can be delivered, and DATABASE_PUBLIC_URL, because `railway run` executes
 * here rather than in the container. See script-db.ts.
 */
import { ConfigService } from '@nestjs/config';
import {
  BootstrapError,
  bootstrapAdmin,
  type BootstrapArgs,
} from '../src/staff/bootstrap-admin';
import { MailService } from '../src/mail/mail.service';
import { scriptPrisma } from './script-db';

const prisma = scriptPrisma();

function parseArgs(argv: string[]): BootstrapArgs {
  const rest = argv.slice(2);
  const reasonArg = rest.find((a) => a.startsWith('--reason='));
  const email = rest.find((a) => !a.startsWith('--'));

  if (!email) {
    throw new BootstrapError(
      'Usage: npm run staff:bootstrap -- <email> [--reason="..."] [--force]',
    );
  }
  return {
    email,
    reason:
      reasonArg?.slice('--reason='.length) || 'Initial administrator bootstrap',
    force: rest.includes('--force'),
  };
}

/**
 * Reuses the password-reset email, which is what an invitation is: claiming it
 * both sets the password and marks the address verified, so following the link
 * is the proof that this person holds the inbox.
 */
async function sendInvite(email: string, token: string) {
  const mail = new MailService(new ConfigService());
  await mail.sendPasswordResetEmail(email, token);
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await bootstrapAdmin(prisma, sendInvite, args);

  switch (result.kind) {
    case 'created':
      console.log(`created ${result.email} as administrator`);
      console.log('Emailed a link to set a password and enrol in two-factor.');
      break;
    case 'promoted':
      console.log(`${result.email}: ${result.from} -> admin`);
      console.log(
        result.invited
          ? 'Emailed a link to set a password and verify the address.'
          : 'They sign in with their existing password, then enrol in two-factor.',
      );
      break;
    case 'already-admin':
      console.log(
        `${result.email} is already an administrator. Nothing to do.`,
      );
      return;
  }
  console.log('Every further account should be invited from the panel.');
}

main()
  .catch((err: unknown) => {
    // A mail failure lands here *after* the account was created, which is
    // recoverable but must not look like nothing happened.
    console.error(err instanceof Error ? err.message : err);
    if (!(err instanceof BootstrapError)) {
      console.error(
        '\nIf the account was created but the email failed, do not re-run: ' +
          'check RESEND_API_KEY and MAIL_FROM, then have them use "Forgot ' +
          'password" to claim it.',
      );
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
