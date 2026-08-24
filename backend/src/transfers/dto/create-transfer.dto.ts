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

  /**
   * The client's own name for this attempt, so a retry after a timeout cannot
   * send the money twice.
   *
   * Bounded to match `FundWalletDto`, which already declared `@Length(8, 128)`
   * while this one declared only `@IsString()`. That asymmetry was the gap: the
   * value is looked up by `where: { idempotencyKey }` on an indexed column and
   * then stored, so an unbounded string is an unbounded index key chosen by the
   * caller — on the endpoint that moves money.
   *
   * The floor is not cosmetic either. A key of "1" collides with every other
   * client that also picks "1", and a collision here does not fail loudly: it
   * returns the *earlier* transfer as though this one had already succeeded.
   * Both clients send a UUID, so nothing legitimate is near either bound.
   */
  @IsOptional()
  @IsString()
  @Length(8, 128)
  idempotencyKey?: string;
}
