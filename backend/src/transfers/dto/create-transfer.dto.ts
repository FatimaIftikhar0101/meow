import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateTransferDto {
  @IsUUID()
  recipientId: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.01)
  sendAmount: number;

  @IsString()
  @Length(3, 3)
  sendCurrency: string;

  @IsString()
  @Length(3, 3)
  receiveCurrency: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
