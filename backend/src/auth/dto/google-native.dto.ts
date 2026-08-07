import { IsString, Length } from 'class-validator';

export class GoogleNativeDto {
  /**
   * A Google ID token (a JWT) from the native sign-in SDK. The bounds are a
   * sanity check only — the signature, issuer, audience and expiry are all
   * verified against Google's keys in AuthService.googleNativeLogin. Without a
   * length cap, ValidationPipe would happily hand a multi-megabyte string to
   * the verifier.
   */
  @IsString()
  @Length(100, 4096)
  idToken!: string;
}
