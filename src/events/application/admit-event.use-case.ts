import { IngestEventDto } from '../dto/ingest-event.dto';
import { fingerprintEvent } from '../event-fingerprint';
import { EventAdmissionPort } from './event-admission.port';

export interface AdmitEventResult {
  eventId: string;
  outcome: 'accepted' | 'conflict';
}

export class AdmitEventUseCase {
  constructor(private readonly admission: EventAdmissionPort) {}

  async execute(event: IngestEventDto): Promise<AdmitEventResult> {
    const fingerprint = fingerprintEvent(event);
    const decision = await this.admission.admit(event, fingerprint);

    if (decision === 'conflict') {
      return { eventId: event.eventId, outcome: 'conflict' };
    }

    // An identical retry receives the same logical acceptance result.
    return { eventId: event.eventId, outcome: 'accepted' };
  }
}
