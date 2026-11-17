import { IngestEventDto } from '../dto/ingest-event.dto';

export const EVENT_ADMISSION_PORT = Symbol('EVENT_ADMISSION_PORT');

export type EventAdmissionDecision = 'accepted' | 'duplicate' | 'conflict';

export class EventAdmissionUnavailableError extends Error {
  constructor() {
    super('Event admission storage is unavailable.');
    this.name = 'EventAdmissionUnavailableError';
  }
}

/**
 * Implementations must atomically reserve eventId and durably publish accepted
 * events. They may return `accepted` only after the queue confirms durability.
 */
export interface EventAdmissionPort {
  admit(
    event: IngestEventDto,
    fingerprint: string,
  ): Promise<EventAdmissionDecision>;
}
