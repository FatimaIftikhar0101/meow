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
    typeof value === 'string' ? value.trim().toUpperCase() : value)
  referralCode?: string;
}
