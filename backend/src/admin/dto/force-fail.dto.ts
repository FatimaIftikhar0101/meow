import { IsString, Length } from 'class-validator';

export class ForceFailDto {
  @IsString()
  @Length(3, 200)
  reason!: string;
}
