/**
 * Appoint the first administrator.
 *
 *   railway run npm run staff:bootstrap -- someone@example.com
 *
 * It prints a six-digit setup code. Give that to the person, who enters it
 * with their email in the back office to choose a password. Nothing is emailed
 * — this runs before anyone can sign in and often before mail is configured at
 * all, and making the first administrator depend on a working mail provider is
 * a poor place to discover it is not one.
 *
 * From then on the panel is the only way in: this administrator invites
 * everyone else, and each of those grants is attributable to a person. So this
 * refuses to run a second time.
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
 * This file is only wiring. The decision it makes lives in
 * src/staff/bootstrap-admin.ts, where it is covered by tests.
 *
 * Needs DATABASE_PUBLIC_URL, because `railway run` executes here rather than
 * in the container. See script-db.ts.
 */
import {
  BootstrapError,
  bootstrapAdmin,
  type BootstrapArgs,
} from '../src/staff/bootstrap-admin';
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

function printCode(code: string) {
  console.log('');
  console.log(`    setup code:  ${code}`);
  console.log('');
  console.log('  Valid for 15 minutes, and usable once. Give it to them, then');
  console.log('  open the back office and choose "I have a setup code".');
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await bootstrapAdmin(prisma, args);

  switch (result.kind) {
    case 'created':
      console.log(`created ${result.email} as administrator`);
      printCode(result.setupCode);
      break;
    case 'promoted':
      console.log(`${result.email}: ${result.from} -> admin`);
      if (result.setupCode) {
        printCode(result.setupCode);
      } else {
        console.log(
          'They sign in with their existing password, then enrol in two-factor.',
        );
      }
      break;
    case 'already-admin':
      console.log(
        `${result.email} is already an administrator. Nothing to do.`,
      );
      return;
  }
  console.log('');
  console.log('Every further account should be invited from the panel.');
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
