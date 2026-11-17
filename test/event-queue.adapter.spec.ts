import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Queue } from 'bullmq';
import { EventAdmissionUnavailableError } from '../src/events/application/event-admission.port';
import { IngestEventDto } from '../src/events/dto/ingest-event.dto';
import { fingerprintEvent } from '../src/events/event-fingerprint';
import {
  BullMqEventAdmissionAdapter,
  QueuedEventData,
} from '../src/events/queue/bullmq-event-admission.adapter';

interface StoredJob {
  data: QueuedEventData;
}

class FakeQueue {
  readonly jobs = new Map<string, StoredJob>();
  addCalls = 0;
  failAdd = false;

  async getJob(jobId: string): Promise<StoredJob | undefined> {
    return this.jobs.get(jobId);
  }

  async add(
    _name: string,
    data: QueuedEventData,
    options: { jobId?: string },
  ): Promise<StoredJob> {
    this.addCalls += 1;
    if (this.failAdd) throw new Error('simulated Redis outage');

    const jobId = options.jobId;
    if (!jobId) throw new Error('missing job ID');

    if (!this.jobs.has(jobId)) this.jobs.set(jobId, { data });
    return this.jobs.get(jobId)!;
  }
}

const event: IngestEventDto = {
  eventId: '5fd55d2a-4506-4cd5-9314-2f0a00a43167',
  eventType: 'order.created',
  schemaVersion: 1,
  occurredAt: '2026-11-17T12:30:00Z',
  payload: { orderId: 'ord-123', totalCents: 4200 },
};

describe('BullMQ event admission adapter', () => {
  it('adds an event once using eventId as the BullMQ job ID', async () => {
    const queue = new FakeQueue();
    const adapter = new BullMqEventAdmissionAdapter(
      queue as unknown as Queue<QueuedEventData>,
    );
    const fingerprint = fingerprintEvent(event);

    assert.equal(await adapter.admit(event, fingerprint), 'accepted');
    assert.equal(queue.addCalls, 1);
    assert.equal(queue.jobs.get(event.eventId)?.data.fingerprint, fingerprint);
  });

  it('recognizes an identical retry and conflicts on reused eventId content', async () => {
    const queue = new FakeQueue();
    const adapter = new BullMqEventAdmissionAdapter(
      queue as unknown as Queue<QueuedEventData>,
    );
    const fingerprint = fingerprintEvent(event);
    const changedEvent = {
      ...event,
      payload: { orderId: 'ord-456' },
    };
    const changedFingerprint = fingerprintEvent(changedEvent);

    assert.equal(await adapter.admit(event, fingerprint), 'accepted');
    assert.equal(await adapter.admit(event, fingerprint), 'duplicate');
    assert.equal(await adapter.admit(changedEvent, changedFingerprint), 'conflict');
    assert.equal(queue.addCalls, 1);
  });

  it('returns the decision for the job that won a concurrent same-ID race', async () => {
    const queue = new FakeQueue();
    const adapter = new BullMqEventAdmissionAdapter(
      queue as unknown as Queue<QueuedEventData>,
    );
    const changed = { ...event, payload: { orderId: 'ord-456' } };

    const results = await Promise.all([
      adapter.admit(event, fingerprintEvent(event)),
      adapter.admit(changed, fingerprintEvent(changed)),
    ]);

    assert.deepEqual(results.sort(), ['accepted', 'conflict']);
    assert.equal(queue.jobs.size, 1);
  });

  it('fails closed if Redis cannot accept the event', async () => {
    const queue = new FakeQueue();
    queue.failAdd = true;
    const adapter = new BullMqEventAdmissionAdapter(
      queue as unknown as Queue<QueuedEventData>,
    );

    await assert.rejects(
      adapter.admit(event, fingerprintEvent(event)),
      EventAdmissionUnavailableError,
    );
    assert.equal(queue.jobs.size, 0);
  });
});
