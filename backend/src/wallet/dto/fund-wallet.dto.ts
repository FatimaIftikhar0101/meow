import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

const upperCase = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.toUpperCase() : value;

export class FundWalletDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(50000)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Transform(upperCase)
  currency?: string;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  idempotencyKey?: string;
}
