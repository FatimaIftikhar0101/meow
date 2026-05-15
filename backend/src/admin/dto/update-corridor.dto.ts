import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

const toNumber = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? Number(value) : value;

export class UpdateCorridorDto {
  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0)
  baseRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  marginBps?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  feeFlat?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  feePercentBps?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  minSendAmount?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  maxSendAmount?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
