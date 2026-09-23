import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { SupportFaqStatus, SupportTicketStatus } from '@prisma/client';

export class CreateSupportTicketDto {
  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  transferId?: string;

  @IsString()
  @Length(3, 120)
  subject!: string;

  @IsString()
  @Length(10, 2000)
  body!: string;
}

export class CreateSupportMessageDto {
  @IsString()
  @Length(1, 2000)
  body!: string;
}

export class ListSupportTicketsDto {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsIn(['mine', 'unassigned'])
  assignment?: 'mine' | 'unassigned';

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class CreateSupportCategoryDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @Length(2, 240)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSupportCategoryDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 240)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateSupportFaqDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @Length(3, 180)
  question!: string;

  @IsString()
  @Length(10, 4000)
  answer!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSupportFaqDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Length(3, 180)
  question?: string;

  @IsOptional()
  @IsString()
  @Length(10, 4000)
  answer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(SupportFaqStatus)
  status?: SupportFaqStatus;
}
