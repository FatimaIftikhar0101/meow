import { IsIn, IsObject, IsOptional, IsUUID, Length } from 'class-validator';
import { ApprovalStatus } from '@prisma/client';

export class CreateApprovalDto {
  /** Must name a registered executor; the service refuses anything else. */
  @Length(3, 60)
  action!: string;

  @IsUUID()
  entityId!: string;

  @Length(3, 200)
  reason!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class DecideApprovalDto {
  /**
   * Required on a rejection as much as on an approval. "No" without a reason
   * tells the person who asked nothing about what to do next.
   */
  @Length(3, 200)
  reason!: string;
}

export class ListApprovalsDto {
  @IsOptional()
  @IsIn(Object.values(ApprovalStatus))
  status?: ApprovalStatus;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
