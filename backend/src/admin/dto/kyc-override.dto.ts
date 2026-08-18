import { IsIn, IsString, Length } from 'class-validator';

export class KycOverrideDto {
  @IsString()
  @IsIn(['passed', 'failed'])
  status!: 'passed' | 'failed';

  /** Required. An override replaces a provider's identity decision with a
   *  human one; the reasoning is the whole record of that judgement. */
  @IsString()
  @Length(3, 200)
  reason!: string;
}
