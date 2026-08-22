import { IsIn, IsOptional, IsUUID, Length } from 'class-validator';
import { AccountKind } from '@prisma/client';

export class ListPostingsDto {
  @IsOptional()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsUUID()
  transferId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  /** Narrow to postings touching an account of this kind — "show me every
   *  movement through transfer suspense" is the question this answers. */
  @IsOptional()
  @IsIn(Object.values(AccountKind))
  kind?: AccountKind;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
