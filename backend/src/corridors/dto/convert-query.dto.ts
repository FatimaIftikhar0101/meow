import { Transform, TransformFnParams } from 'class-transformer';
import { IsNumber, IsString, Length, Min } from 'class-validator';

const upperCase = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.toUpperCase() : value;

const toNumber = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? Number(value) : value;

export class ConvertQueryDto {
  @IsString()
  @Length(3, 3)
  @Transform(upperCase)
  from!: string;

  @IsString()
  @Length(3, 3)
  @Transform(upperCase)
  to!: string;

  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  amount!: number;
}
