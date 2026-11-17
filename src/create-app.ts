import { LoggerService, Type, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import helmet from 'helmet';
import * as hpp from 'hpp';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';
import { StructuredLogger } from './observability/structured-logger';

export const MAX_REQUEST_BODY_BYTES = 256 * 1024;

export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

export async function createApp(
  config: AppConfig,
  logger: LoggerService | false = new StructuredLogger(),
  rootModule: Type<unknown> = AppModule,
) {
  const app = await NestFactory.create(rootModule, {
    logger,
    bodyParser: false,
  });

  app.use(json({ limit: MAX_REQUEST_BODY_BYTES }));
  app.use(helmet());
  app.use(hpp());
  app.useGlobalPipes(createGlobalValidationPipe());

  if (config.corsOrigins.length > 0) {
    app.enableCors({
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    });
  }

  return app;
}
