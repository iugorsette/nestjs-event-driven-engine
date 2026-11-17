import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { loadAppConfig } from '../../config/app-config';
import {
  EventProcessorPort,
  EVENT_PROCESSOR,
} from '../application/event-processor.port';
import { IngestEventDto } from '../dto/ingest-event.dto';
import { fingerprintEvent } from '../event-fingerprint';
import { StructuredLogger } from '../../observability/structured-logger';
import {
  EVENT_QUEUE_NAME,
  PROCESS_EVENT_JOB_NAME,
} from '../queue/event-queue.constants';
import { QueuedEventData } from '../queue/bullmq-event-admission.adapter';

@Processor(EVENT_QUEUE_NAME, {
  concurrency: loadAppConfig().workerConcurrency,
})
@Injectable()
export class EventIngestionWorker extends WorkerHost {
  constructor(
    @Inject(EVENT_PROCESSOR)
    private readonly eventProcessor: EventProcessorPort,
    private readonly logger: StructuredLogger,
  ) {
    super();
  }

  async process(job: Job<QueuedEventData>): Promise<{ eventId: string }> {
    let event: IngestEventDto | undefined;

    try {
      event = await this.parseJob(job);
      await this.eventProcessor.process(event);
      this.logger.log({
        event: 'event.processing.completed',
        eventId: event.eventId,
        eventType: event.eventType,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      });
      return { eventId: event.eventId };
    } catch (error) {
      this.logger.error({
        event: 'event.processing.failed',
        eventId: event?.eventId ?? job.id,
        ...(event ? { eventType: event.eventType } : {}),
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        retryable: !(error instanceof UnrecoverableError),
      });
      throw error instanceof Error ? error : new Error('Event processing failed.');
    }
  }

  private async parseJob(job: Job<QueuedEventData>): Promise<IngestEventDto> {
    const data: unknown = job.data;
    if (
      job.name !== PROCESS_EVENT_JOB_NAME ||
      data === null ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      throw new UnrecoverableError('Invalid event job envelope.');
    }

    const record = data as Record<string, unknown>;
    const allowedKeys = ['event', 'fingerprint'];
    if (
      Object.keys(record).some((key) => !allowedKeys.includes(key)) ||
      typeof record.fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(record.fingerprint) ||
      record.event === null ||
      typeof record.event !== 'object' ||
      Array.isArray(record.event)
    ) {
      throw new UnrecoverableError('Invalid event job envelope.');
    }

    const event = plainToInstance(IngestEventDto, record.event);
    const errors = await validate(event, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0 || fingerprintEvent(event) !== record.fingerprint) {
      throw new UnrecoverableError('Invalid event job payload.');
    }

    return event;
  }
}
