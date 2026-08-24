/**
 * How long each field is allowed to be, mirroring the server.
 *
 * The same table as `mobile/lib/limits.ts` and for the same reason: every value
 * here already exists as a `class-validator` decorator on a DTO under
 * `backend/src`, the server is what enforces it, and a `maxLength` on an input
 * is a courtesy rather than a control.
 *
 * The courtesy matters more in this panel than in the app, because of what the
 * fields are. Almost every write a staff member makes carries a `reason`, and
 * that reason is not decoration — `writeStaffAudit` will not record an action
 * without one, and it is the part of the record a reviewer actually reads. A
 * reason rejected by the server after the fact costs someone the sentence they
 * had just written; a reason silently truncated would be worse, because the
 * audit log would then hold half an explanation and nobody would know.
 *
 * Each entry names the DTO it mirrors so the pairing can be checked.
 */

export const LIMITS = {
  /** LoginDto: `@IsEmail() @MaxLength(254)`. The RFC ceiling. */
  email: 254,
  /** LoginDto.password: `@MaxLength(128)`. */
  password: 128,
  /** ClaimAccountDto.newPassword: `@Length(10, 128)`. */
  newPassword: 128,
  /** ResetPasswordDto.code / ClaimAccountDto: `@Length(6, 12)`. */
  setupCode: 12,
  /** MfaVerifyDto.code: `@Length(6, 32)` — recovery codes are longer than the
   *  six TOTP digits, which is why this is not 6. */
  mfaCode: 32,

  /**
   * The `reason` on an audited staff action — but there are two bounds, not
   * one, and the difference is load-bearing.
   *
   * `SuspendDto`, `RevealAccountDto`, `RetryTransferDto`, `AssignRoleDto`,
   * `StaffReasonDto`, `KycOverrideDto` and `ForceFailDto` all declare
   * `@Length(3, 200)`. The screening module does not: `AdjudicateAlertDto`,
   * the case bodies and `AddBlocklistDto` declare `@Length(3, 300)`.
   *
   * That looked at first like an inconsistency worth flattening to the lower
   * number, which would have been a bug of exactly the kind this file exists
   * to prevent — capping a compliance officer at 200 characters on a field the
   * server would have accepted 300 of, with no error to explain the missing
   * hundred. It is also defensible as written: a reason for escalating an
   * alert is the longest-form thing anyone types in this panel.
   *
   * So both are named. `reason` is the default because it is the stricter and
   * the more common; screening call sites pass `reasonLong` explicitly.
   */
  reason: 200,
  /** The screening module's reasons: `@Length(3, 300)`. */
  reasonLong: 300,
  /** Shared lower bound on all of them. "ok" is not an explanation. */
  reasonMin: 3,

  /** AddBlocklistDto.display: `@Length(1, 200)`. */
  blocklistValue: 200,
  /** ListAlertsDto.rule: `@Length(2, 40)`. */
  alertRule: 40,

  /** CreateNoteDto.body: `@Length(1, 2000)`. */
  note: 2000,
  /** ListTransfersDto.q: `@Length(1, 120)`. Shared by the other search boxes,
   *  which filter client-side and so have no server bound of their own. */
  search: 120,

  /** InviteStaffDto.firstName / lastName: `@Length(1, 80)`. */
  staffName: 80,
} as const;
