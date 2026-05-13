import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';

const lowerTrim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  @Transform(lowerTrim)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
