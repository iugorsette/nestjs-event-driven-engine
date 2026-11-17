import 'dotenv/config';
import 'reflect-metadata';
import { loadAppConfig } from './config/app-config';
import { createApp } from './create-app';
import { StructuredLogger } from './observability/structured-logger';

const logger = new StructuredLogger();

async function bootstrap(): Promise<void> {
  const config = loadAppConfig();
  const app = await createApp(config, logger);
  await app.listen(config.port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  logger.fatal({ event: 'startup.failed', message });
  process.exitCode = 1;
});
