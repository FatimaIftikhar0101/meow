import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const upperCase = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.toUpperCase() : value;

export class CreateRecipientDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{6,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;

  @IsString()
  @Length(2, 2)
  @Transform(upperCase)
  country!: string;

  @IsString()
  @Length(4, 40)
  bankAccount!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  bankName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  bankCode?: string;
}
