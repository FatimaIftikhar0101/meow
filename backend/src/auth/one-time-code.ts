import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Short codes people type, instead of links they click.
 *
 * Links were the obvious choice and turned out to be the fragile one. Corporate
 * mail scanners and spam filters *fetch* every URL in a message to check it is
 * safe, which consumes a single-use reset link before its owner ever sees it —
 * the user then clicks and is told the link is invalid. A code cannot be spent
 * by being read.
 *
 * They also survive the situation this product is actually in: no domain, so
 * mail is more likely to be filtered, and a short code is easier to relay by
 * any other means than a hundred-character URL.
 *
 * ## Why six digits is safe here, and what makes it safe
 *
 * A million possibilities is not much on its own. Three things carry it:
 *
 *  - **The code is scoped to one account.** Verification takes an email as well,
 *    so an attacker must guess the code for a specific person rather than find
 *    any valid code anywhere.
 *  - **Attempts are counted and the code dies at five.** One in two hundred
 *    thousand per burst, and the burst ends the code.
 *  - **It expires in fifteen minutes**, so guessing cannot be spread out.
 *
 * Remove any one of those and six digits stops being defensible. The attempt
 * counter especially: without it this is trivially brute-forced.
 *
 * Stored as a bcrypt hash. A short-lived low-entropy secret is still a secret,
 * and anyone reading the table should not be able to use what they find.
 */

const DIGITS = 6;
export const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

/**
 * A six-digit code, uniformly distributed.
 *
 * `randomInt` rather than `randomBytes % 1000000`: the modulo of a byte range
 * that is not a multiple of the range skews the low values, and a biased code
 * is a smaller search space than it looks.
 */
export function generateCode(): string {
  return crypto
    .randomInt(0, 10 ** DIGITS)
    .toString()
    .padStart(DIGITS, '0');
}

export function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

export function codeExpiry(): Date {
  return new Date(Date.now() + CODE_TTL_MS);
}

/** People type codes with spaces, and paste them with trailing whitespace. */
export function normaliseCode(code: string): string {
  return code.replace(/[\s-]/g, '');
}

export interface CodeRecord {
  hash: string | null;
  expires: Date | null;
  attempts: number;
}

export type CodeCheck =
  | { ok: true }
  /** Spent, expired, or never issued. The caller must not say which. */
  | { ok: false; reason: 'invalid' | 'expired' | 'locked'; attempts: number };

/**
 * Check a code against a stored record.
 *
 * Returns rather than throws, and reports the attempt count, because the caller
 * has to persist that count — a check that does not increment on failure is not
 * rate limited at all.
 */
export async function checkCode(
  supplied: string,
  record: CodeRecord,
): Promise<CodeCheck> {
  if (!record.hash || !record.expires) {
    return { ok: false, reason: 'invalid', attempts: record.attempts };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'locked', attempts: record.attempts };
  }
  if (record.expires.getTime() < Date.now()) {
    return { ok: false, reason: 'expired', attempts: record.attempts };
  }

  const matches = await bcrypt.compare(normaliseCode(supplied), record.hash);
  return matches
    ? { ok: true }
    : { ok: false, reason: 'invalid', attempts: record.attempts + 1 };
}
