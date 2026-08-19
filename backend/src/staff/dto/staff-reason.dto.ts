import { IsString, Length } from 'class-validator';

/** Deactivating a colleague's access is the kind of thing that gets queried
 *  months later, usually by someone who was not in the room. */
export class StaffReasonDto {
  @IsString()
  @Length(3, 200)
  reason!: string;
}
