import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class KycOverrideDto {
  @IsString()
  @IsIn(['passed', 'failed'])
  status!: 'passed' | 'failed';

  @IsOptional()
  @IsString()
  @Length(3, 200)
  reason?: string;
}
