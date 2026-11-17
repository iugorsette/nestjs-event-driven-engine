import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { loadAppConfig } from '../../config/app-config';
import { StructuredLogger } from '../../observability/structured-logger';
import { EVENT_PROCESSOR } from '../application/event-processor.port';
import { EventsQueueModule } from '../queue/events-queue.module';
import { DemoEventProcessor } from './demo-event-processor';
import { EventIngestionWorker } from './event-ingestion.worker';

@Module({
  imports: [
    BullModule.forRoot({ connection: loadAppConfig().redis }),
    EventsQueueModule,
  ],
  providers: [
    StructuredLogger,
    EventIngestionWorker,
    DemoEventProcessor,
    { provide: EVENT_PROCESSOR, useExisting: DemoEventProcessor },
  ],
})
export class EventsWorkerModule {}
