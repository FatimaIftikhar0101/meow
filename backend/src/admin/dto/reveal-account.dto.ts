import { IsOptional, IsUUID, Length } from 'class-validator';

/**
 * Ask to see one full bank account number.
 *
 * Exactly one of `recipientId` / `transferId` — a reveal names the single
 * record it is for, so the audit entry can too. "Show me this customer's
 * account numbers" is not a request this endpoint can express, deliberately:
 * it would produce one audit row covering an unbounded set.
 *
 * The reason is required by the DTO and again by `writeStaffAudit`'s type. It
 * is the only part of the record that says *why* someone looked.
 */
export class RevealAccountDto {
  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @IsOptional()
  @IsUUID()
  transferId?: string;

  @Length(3, 200)
  reason!: string;
}
