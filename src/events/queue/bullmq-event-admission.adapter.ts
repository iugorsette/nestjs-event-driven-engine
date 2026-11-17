import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { IngestEventDto } from '../dto/ingest-event.dto';
import {
  EventAdmissionDecision,
  EventAdmissionPort,
  EventAdmissionUnavailableError,
} from '../application/event-admission.port';
import { classifyEventSubmission } from '../event-fingerprint';
import { EVENT_QUEUE_NAME, PROCESS_EVENT_JOB_NAME } from './event-queue.constants';

export interface QueuedEventData {
  event: IngestEventDto;
  fingerprint: string;
}

@Injectable()
export class BullMqEventAdmissionAdapter implements EventAdmissionPort {
  constructor(
    @InjectQueue(EVENT_QUEUE_NAME)
    private readonly queue: Queue<QueuedEventData>,
  ) {}

  async admit(
    event: IngestEventDto,
    fingerprint: string,
  ): Promise<EventAdmissionDecision> {
    try {
      const existing = await this.queue.getJob(event.eventId);
      if (existing) {
        return this.classifyAgainstStoredJob(event, existing);
      }

      await this.queue.add(
        PROCESS_EVENT_JOB_NAME,
        { event, fingerprint },
        {
          jobId: event.eventId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1_000 },
        },
      );

      // Read back the ID after add: simultaneous requests may race, but BullMQ
      // creates at most one job for this queue/jobId pair.
      const persisted = await this.queue.getJob(event.eventId);
      if (!persisted) {
        throw new Error('BullMQ did not return the enqueued event job.');
      }

      const persistedDecision = this.classifyAgainstStoredJob(event, persisted);
      // This call observed no earlier record; if a concurrent identical add
      // won the race, both callers still receive the same accepted outcome.
      return persistedDecision === 'duplicate' ? 'accepted' : persistedDecision;
    } catch {
      throw new EventAdmissionUnavailableError();
    }
  }

  private classifyAgainstStoredJob(
    event: IngestEventDto,
    job: Job<QueuedEventData>,
  ): EventAdmissionDecision {
    if (!job.data || typeof job.data.fingerprint !== 'string') {
      throw new Error('Stored event job has no valid fingerprint.');
    }

    const classification = classifyEventSubmission(event, job.data.fingerprint);
    return classification === 'new' ? 'accepted' : classification;
  }
}
