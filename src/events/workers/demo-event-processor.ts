import { Injectable } from '@nestjs/common';
import { IngestEventDto } from '../dto/ingest-event.dto';
import { StructuredLogger } from '../../observability/structured-logger';
import { EventProcessorPort } from '../application/event-processor.port';

/**
 * Portfolio placeholder: demonstrates the worker boundary without claiming
 * that an event has been persisted or that a business side effect is durable.
 */
@Injectable()
export class DemoEventProcessor implements EventProcessorPort {
  constructor(private readonly logger: StructuredLogger) {}

  async process(event: IngestEventDto): Promise<void> {
    this.logger.log({
      event: 'event.demo-handler.completed',
      eventId: event.eventId,
      eventType: event.eventType,
      schemaVersion: event.schemaVersion,
    });
  }
}
