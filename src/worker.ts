import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { loadAppConfig } from './config/app-config';
import { EventsWorkerModule } from './events/workers/events-worker.module';
import { StructuredLogger } from './observability/structured-logger';

async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(EventsWorkerModule);
  app.useLogger(app.get(StructuredLogger));
  app.enableShutdownHooks();
  app.get(StructuredLogger).log({
    event: 'worker.started',
    concurrency: loadAppConfig().workerConcurrency,
  });
}

void bootstrapWorker().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  process.stderr.write(
    `${JSON.stringify({ event: 'worker.startup.failed', message })}\n`,
  );
  process.exitCode = 1;
});
