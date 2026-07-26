import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  // CORS_ORIGINS is a comma-separated allowlist and is separate from
  // FRONTEND_ORIGIN on purpose: FRONTEND_ORIGIN is the *browser-reachable*
  // base used to build email links and the post-OAuth redirect, while the
  // allowlist also has to admit the Capacitor origins the mobile shell sends
  // (capacitor://localhost on iOS, http(s)://localhost on Android), which are
  // not valid link targets. Falls back to FRONTEND_ORIGIN when unset.
  const corsOrigins = (
    config.get<string>('CORS_ORIGINS') ||
    config.get<string>('FRONTEND_ORIGIN') ||
    'http://localhost:3001'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
}

void bootstrap();
