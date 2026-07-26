import {
  CanActivate,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Rejects the Google OAuth routes with a clear 501 when Google is not
 * configured.
 *
 * `GoogleStrategy` is only registered when GOOGLE_CLIENT_ID/SECRET are set
 * (see AuthModule), so without this guard `AuthGuard('google')` would fail
 * with an opaque "Unknown authentication strategy" 500.
 *
 * Must be listed before `AuthGuard('google')` in @UseGuards — guards run in
 * declaration order.
 */
@Injectable()
export class GoogleEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    const clientID = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientID || !clientSecret) {
      throw new NotImplementedException('Google sign-in is not configured');
    }
    return true;
  }
}
