import { IngestEventDto } from '../dto/ingest-event.dto';

export const EVENT_PROCESSOR = Symbol('EVENT_PROCESSOR');

/** Application boundary for the side effect performed by a worker. */
export interface EventProcessorPort {
  process(event: IngestEventDto): Promise<void>;
}
