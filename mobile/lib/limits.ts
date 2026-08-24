/**
 * How long each field is allowed to be, mirroring the server.
 *
 * These are not new rules. Every value here already exists as a `class-validator`
 * decorator on a DTO under `backend/src`, and the server is what actually
 * enforces them — a `maxLength` on an input is a courtesy, not a control, and
 * anything that trusts it is a bug waiting for someone with a REST client.
 *
 * What the courtesy buys is real, though. Without it the first time you learn a
 * beneficiary name is too long is *after* you typed 300 characters and pressed
 * Save, and the message comes back as a validation error about a field you
 * thought you had finished. Stopping the keystroke is a smaller, earlier and
 * more honest answer than rejecting the submission.
 *
 * They live in one file because the failure mode of scattering them is silent:
 * a cap of 100 against a server bound of 120 does not error, it just truncates
 * someone's name and nobody finds out. When a DTO changes, this file is the one
 * place to change with it.
 *
 * Each entry names the DTO it mirrors so the pairing can be checked.
 */

export const LIMITS = {
  /** RegisterDto / LoginDto: `@IsEmail() @MaxLength(254)`. The RFC ceiling. */
  email: 254,
  /** RegisterDto.fullName: `@Length(2, 100)`. */
  fullName: 100,
  /** LoginDto.password `@MaxLength(128)`; RegisterDto `@Length(10, 128)`. */
  password: 128,
  /** RegisterDto.country: `@Length(2, 60)` — the app sends an ISO-3166 pair. */
  country: 2,
  /** RegisterDto.referralCode: `@MaxLength(20)`. */
  referralCode: 20,
  /** ResetPasswordDto.code: `@Length(6, 12)`. Recovery codes are longer than
   *  the six-digit email code, which is why this is not 6. */
  resetCode: 12,

  /** CreateRecipientDto.name: `@Length(2, 120)`. */
  recipientName: 120,
  /** CreateRecipientDto.bankAccount: `@Length(4, 40)`. */
  bankAccount: 40,
  /** CreateRecipientDto.bankName: `@Length(1, 80)`. */
  bankName: 80,
  /** CreateRecipientDto.phone: `@Matches(/^\+?[0-9 ()-]{6,20}$/)` — the regex
   *  caps the digits at 20, so the field does too. */
  phone: 20,
} as const;
