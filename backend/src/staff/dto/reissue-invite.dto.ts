import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

/**
 * Issue a fresh setup code for an invitation that was never claimed.
 *
 * Same shape as the tail of `InviteStaffDto` — a reason and an optional email
 * copy — and deliberately nothing else. Reissuing must not be a back door for
 * editing the account it points at: the address, the role and the name are all
 * fixed at invitation and changing any of them is a different, separately
 * audited action.
 */
export class ReissueInviteDto {
  /** Why this person needs a second code. Read by whoever reviews the
   *  compliance programme, alongside the invitation it follows. */
  @IsString()
  @Length(3, 200)
  reason!: string;

  /**
   * Send the new code to their address as well as showing it.
   *
   * Off by default, exactly as on the invitation. The code is always returned
   * to the admin who asked for it.
   */
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
