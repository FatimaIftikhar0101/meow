import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ScalableIoAdapter } from './common/ws/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  // CORS_ORIGINS is a comma-separated allowlist, separate from
  // FRONTEND_ORIGIN on purpose: FRONTEND_ORIGIN is the browser-reachable base
  // used to build email links and the post-OAuth redirect, whereas several
  // distinct origins (web app, admin, previews) may legitimately call the API.
  // Falls back to FRONTEND_ORIGIN when unset.
  //
  // This constrains browsers only — CORS is enforced client-side off the
  // Origin header. A native client sends no Origin and is unaffected, so this
  // is not an access control.
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

  // Before listen(), so a misconfigured Redis stops the process from taking
  // traffic rather than accepting it and dropping events. Without REDIS_URL
  // this is a no-op and socket.io keeps its rooms in memory as it always has.
  const wsAdapter = new ScalableIoAdapter(app, config.get<string>('REDIS_URL'));
  await wsAdapter.connect();
  app.useWebSocketAdapter(wsAdapter);

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
}

void bootstrap();
