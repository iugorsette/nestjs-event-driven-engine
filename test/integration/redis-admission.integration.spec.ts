import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { loadAppConfig } from '../../src/config/app-config';
import { createApp } from '../../src/create-app';
import { AppModule } from '../../src/app.module';
import { IngestEventDto } from '../../src/events/dto/ingest-event.dto';
import { fingerprintEvent } from '../../src/events/event-fingerprint';
import {
  BullMqEventAdmissionAdapter,
  QueuedEventData,
} from '../../src/events/queue/bullmq-event-admission.adapter';
import { EVENT_QUEUE_NAME } from '../../src/events/queue/event-queue.constants';

describe('BullMQ Redis integration', () => {
  let app: INestApplication;
  let queue: Queue<QueuedEventData>;
  let adapter: BullMqEventAdmissionAdapter;

  before(async () => {
    app = await createApp(loadAppConfig({ NODE_ENV: 'test' }), false, AppModule);
    await app.init();
    adapter = app.get(BullMqEventAdmissionAdapter, { strict: false });
    queue = app.get<Queue<QueuedEventData>>(getQueueToken(EVENT_QUEUE_NAME), {
      strict: false,
    });
  });

  after(async () => {
    if (lastEventId) {
      const job = await queue.getJob(lastEventId);
      if (job) await job.remove();
    }
    await app.close();
  });

  let lastEventId: string | undefined;

  it('persists one event, returns duplicate on retry, and detects ID conflict', async () => {
    const event: IngestEventDto = {
      eventId: randomUUID(),
      eventType: 'order.created',
      schemaVersion: 1,
      occurredAt: '2026-11-17T12:30:00Z',
      payload: { orderId: 'ord-integration', totalCents: 4200 },
    };
    lastEventId = event.eventId;
    const fingerprint = fingerprintEvent(event);

    assert.equal(await adapter.admit(event, fingerprint), 'accepted');
    assert.equal(await adapter.admit(event, fingerprint), 'duplicate');
    assert.equal(
      await adapter.admit(
        { ...event, payload: { orderId: 'ord-other' } },
        fingerprintEvent({ ...event, payload: { orderId: 'ord-other' } }),
      ),
      'conflict',
    );

    const job = await queue.getJob(event.eventId);
    assert.ok(job);
    assert.equal(job.data.fingerprint, fingerprint);
  });
});
