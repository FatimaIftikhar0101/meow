import { IsString, Length } from 'class-validator';

/**
 * Suspending an account cuts a customer off from their own money. It used to
 * take no body at all, so the audit trail recorded that it happened and never
 * why — which is the first question anyone reviewing the decision will ask.
 */
export class SuspendDto {
  @IsString()
  @Length(3, 200)
  reason!: string;
}
