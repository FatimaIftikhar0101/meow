import { TransferStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * The operations queue's filters.
 *
 * These were previously loose `@Query()` strings. An unrecognised status went
 * straight into a Prisma `where` and came back as a 500 — an operator's typo
 * presenting as the server being broken, which is the worst way for a filter to
 * fail on a screen someone is using during an incident.
 */
export class ListTransfersDto {
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;

  /**
   * Only transfers past the threshold for the status they are sitting in,
   * oldest first. See `aging.ts` for the thresholds and why they differ.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  aging?: boolean;

  /**
   * Collapse the per-status thresholds to one number of minutes. Only read when
   * `aging` is set. For the incident question the defaults cannot answer:
   * "what has been sitting for over half an hour, whatever it thinks it is
   * doing?"
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60 * 24 * 30)
  olderThanMins?: number;

  /** Sender email, beneficiary name, or the start of a transfer id. */
  @IsOptional()
  @IsString()
  @Length(1, 120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
