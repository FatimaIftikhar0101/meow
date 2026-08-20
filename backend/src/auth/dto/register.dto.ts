import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const lowerTrim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  @Transform(lowerTrim)
  email!: string;

  /**
   * The user's full name as they write it. Collected as one field rather than
   * separate first/last inputs: name structure varies by culture, and a single
   * field lets people enter their name correctly instead of forcing it into
   * two boxes. The split into firstName/lastName for display happens in
   * AuthService and is deliberately naive — see splitName().
   *
   * Required for new sign-ups; a remittance sender's name is needed for the
   * transfer record. Existing accounts predate this and stay null.
   */
  @IsString()
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value,
  )
  @Length(2, 100)
  fullName!: string;

  @IsString()
  @Length(10, 128)
  @Matches(/[a-z]/, { message: 'password must contain a lowercase letter' })
  @Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' })
  @Matches(/[0-9]/, { message: 'password must contain a digit' })
  password!: string;

  @IsOptional()
  @IsString()
  @Length(2, 60)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  referralCode?: string;
}
