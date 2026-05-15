import { IsString, Length, Matches, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @Length(10, 128)
  @Matches(/[a-z]/, { message: 'newPassword must contain a lowercase letter' })
  @Matches(/[A-Z]/, { message: 'newPassword must contain an uppercase letter' })
  @Matches(/[0-9]/, { message: 'newPassword must contain a digit' })
  newPassword!: string;
}
