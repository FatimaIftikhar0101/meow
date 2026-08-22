import { Length } from 'class-validator';

export class CreateNoteDto {
  /**
   * Long enough for what a call actually produces, capped so the note field
   * does not become where someone pastes a document.
   */
  @Length(1, 2000)
  body!: string;
}
