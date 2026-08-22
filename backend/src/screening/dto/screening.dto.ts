import { IsIn, IsOptional, IsUUID, Length } from 'class-validator';
import { AlertStatus, BlocklistKind, CaseStatus } from '@prisma/client';

export class ListAlertsDto {
  @IsOptional() @IsIn(Object.values(AlertStatus)) status?: AlertStatus;
  @IsOptional() @Length(2, 40) rule?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() page?: number;
  @IsOptional() pageSize?: number;
}

export class AdjudicateAlertDto {
  @IsIn(['cleared', 'escalated'])
  status!: 'cleared' | 'escalated';

  /** Required on a clear as much as on an escalation. An alert cleared without
   *  one records that somebody made it disappear, not that somebody looked. */
  @Length(3, 300)
  reason!: string;

  @IsOptional()
  @IsUUID()
  caseId?: string;
}

export class ListCasesDto {
  @IsOptional() @IsIn(Object.values(CaseStatus)) status?: CaseStatus;
  @IsOptional() page?: number;
  @IsOptional() pageSize?: number;
}

export class OpenCaseDto {
  @IsUUID() userId!: string;
  @Length(3, 500) summary!: string;
}

export class ReasonDto {
  @Length(3, 300) reason!: string;
}

export class AddBlocklistDto {
  @IsIn(Object.values(BlocklistKind)) kind!: BlocklistKind;
  @Length(1, 200) display!: string;
  @Length(3, 300) reason!: string;
}
