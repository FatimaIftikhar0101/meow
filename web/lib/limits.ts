/**
 * How long each field is allowed to be, mirroring the server.
 *
 * The third copy of this table, after `mobile/lib/limits.ts` and
 * `admin/src/lib/limits.ts`. Every value already exists as a `class-validator`
 * decorator on a DTO under `backend/src`, and the server is what enforces it —
 * a `maxLength` on an input is a courtesy, not a control.
 *
 * The courtesy is what was missing here. The signup form bounded the name and
 * the referral code and left the email and password open, so the first thing
 * anyone learned about the 254-character ceiling was a validation error after
 * pressing Create account. Three clients had three different answers to the
 * same question, which is how that happens.
 *
 * Each entry names the DTO it mirrors so the pairing can be checked.
 */

export const LIMITS = {
  /** RegisterDto / LoginDto: `@IsEmail() @MaxLength(254)`. The RFC ceiling. */
  email: 254,
  /** RegisterDto.fullName: `@Length(2, 100)`. */
  fullName: 100,
  /** LoginDto.password: `@MaxLength(128)`. */
  password: 128,
  /** RegisterDto.password / ChangePasswordDto.newPassword: `@Length(10, 128)`. */
  newPassword: 128,
  /** The lower bound on any new password, matched by the `minLength` already
   *  on these fields. Named so the two cannot drift apart. */
  passwordMin: 10,
  /** RegisterDto.referralCode: `@MaxLength(20)`. */
  referralCode: 20,
  /** ResetPasswordDto.code: `@Length(6, 12)`. */
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
