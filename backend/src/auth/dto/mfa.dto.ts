import { IsString, Length, Matches } from 'class-validator';

/** A six-digit time-based code, or one of the recovery codes handed out at
 *  enrolment. Deliberately one field: making the caller declare which kind it
 *  is buys nothing and gives an attacker a way to probe. */
export class MfaCodeDto {
  @IsString()
  @Length(6, 32)
  @Matches(/^[A-Za-z0-9\s-]+$/, { message: 'code contains invalid characters' })
  code!: string;
}

export class MfaLoginDto extends MfaCodeDto {
  /** The short-lived challenge handed back by /auth/admin/login. Not an access
   *  token, and rejected as one everywhere. */
  @IsString()
  @Length(20, 4096)
  mfaToken!: string;
}
