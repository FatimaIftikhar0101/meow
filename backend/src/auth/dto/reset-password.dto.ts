import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  /**
   * Which account the code belongs to.
   *
   * A six-digit code is not unique on its own. Without the address an attacker
   * guesses against every outstanding code at once instead of against one
   * person, and the search space collapses from a million to a million divided
   * by however many resets are in flight.
   */
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 12)
  code!: string;

  @IsString()
  @Length(10, 128)
  @Matches(/[a-z]/, { message: 'newPassword must contain a lowercase letter' })
  @Matches(/[A-Z]/, { message: 'newPassword must contain an uppercase letter' })
  @Matches(/[0-9]/, { message: 'newPassword must contain a digit' })
  newPassword!: string;
}

/** Verifying an address needs the same pair, and no password. */
export class VerifyEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 12)
  code!: string;
}
