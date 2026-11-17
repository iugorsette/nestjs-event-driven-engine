import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import hpp from 'hpp';
import { AppModule } from './app.module';
import { loadAppConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  const config = loadAppConfig();
  const app = await NestFactory.create(AppModule, { rawBody: false });

  app.use(helmet());
  app.use(hpp());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (config.corsOrigins.length > 0) {
    app.enableCors({
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    });
  }

  await app.listen(config.port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  process.stderr.write(
    `${JSON.stringify({ level: 'fatal', event: 'startup.failed', message })}\n`,
  );
  process.exitCode = 1;
});
