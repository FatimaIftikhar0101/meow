import { Logger, Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    MailModule,
    forwardRef(() => ReferralsModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_SECRET') ??
          (() => {
            throw new Error('JWT_SECRET must be set');
          })(),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as
            | `${number}d`
            | `${number}h`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Registered only when Google is actually configured. passport-oauth2
    // throws `OAuth2Strategy requires a clientID option` from its constructor
    // on an empty clientID, which would take the whole app down at boot. The
    // env schema treats GOOGLE_* as optional, so an environment without Google
    // credentials must still start — it just serves email/password auth.
    {
      provide: GoogleStrategy,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const clientID = config.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
        if (!clientID || !clientSecret) {
          new Logger('AuthModule').warn(
            'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google sign-in is disabled; /auth/google returns 501.',
          );
          return null;
        }
        return new GoogleStrategy(config);
      },
    },
  ],
  exports: [AuthService, JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
