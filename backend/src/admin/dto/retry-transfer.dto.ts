import { IsString, Length } from 'class-validator';

export class RetryTransferDto {
  /**
   * Why this transfer is being pushed by hand.
   *
   * Required for the same reason every other staff action requires one: the
   * audit writer will not record an action without it, and "operations retried
   * it" tells a later reviewer nothing about whether they should have.
   */
  @IsString()
  @Length(3, 200)
  reason!: string;
}
