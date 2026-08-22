import { IsIn, IsOptional } from 'class-validator';
import { KycStatus } from '@prisma/client';

export class ListKycDto {
  @IsOptional()
  @IsIn(Object.values(KycStatus))
  status?: KycStatus;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
