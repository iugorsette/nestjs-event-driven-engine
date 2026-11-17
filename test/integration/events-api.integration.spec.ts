import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createApp } from '../../src/create-app';
import { APP_CONFIG, loadAppConfig } from '../../src/config/app-config';
import { EventsController } from '../../src/events/events.controller';
import { IngestEventDto } from '../../src/events/dto/ingest-event.dto';
import { QueuedEventData } from '../../src/events/queue/bullmq-event-admission.adapter';
import { EVENT_QUEUE_NAME } from '../../src/events/queue/event-queue.constants';
import { EventsQueueModule } from '../../src/events/queue/events-queue.module';
import { ProducerApiKeyGuard } from '../../src/security/producer-api-key.guard';
import { RateLimitingModule } from '../../src/security/rate-limiting/rate-limiting.module';

const apiKey = 'portfolio-redis-test-key-0123456789abcdef';
const config = loadAppConfig({
  ...process.env,
  NODE_ENV: 'test',
  INGEST_API_KEY: apiKey,
});

@Module({
  imports: [
    BullModule.forRoot({ connection: config.redis }),
    EventsQueueModule,
    RateLimitingModule,
  ],
  controllers: [EventsController],
  providers: [
    ProducerApiKeyGuard,
    { provide: APP_CONFIG, useValue: config },
  ],
})
class RedisBackedIngestionTestModule {}

describe('POST /events with Redis', () => {
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  let queue: Queue<QueuedEventData>;
  let baseUrl: string;
  let eventId: string | undefined;
  const clientIp = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

  before(async () => {
    app = await createApp(config, false, RedisBackedIngestionTestModule);
    // Trust only the local test proxy and use a fresh tracker per run so Redis
    // state from an earlier run cannot affect the 30-request assertion.
    app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    queue = app.get<Queue<QueuedEventData>>(getQueueToken(EVENT_QUEUE_NAME));
  });

  after(async () => {
    try {
      if (eventId) {
        const job = await queue?.getJob(eventId);
        if (job) await job.remove();
      }
    } finally {
      app?.getHttpServer().closeAllConnections();
      await app?.close();
    }
  });

  it('confirms queue admission, deduplicates retries, detects conflicts and throttles by IP', async () => {
    const event: IngestEventDto = {
      eventId: randomUUID(),
      eventType: 'portfolio.integration',
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: { scenario: 'redis-backed-http-ingestion' },
    };
    eventId = event.eventId;

    const post = (body: IngestEventDto) =>
      fetch(`${baseUrl}/events`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'x-forwarded-for': clientIp,
        },
        body: JSON.stringify(body),
      });

    const accepted = await post(event);
    assert.equal(accepted.status, 202);
    assert.deepEqual(await accepted.json(), {
      eventId: event.eventId,
      status: 'accepted',
    });

    const duplicate = await post(event);
    assert.equal(duplicate.status, 202);

    const conflict = await post({
      ...event,
      payload: { scenario: 'different-content' },
    });
    assert.equal(conflict.status, 409);

    const persisted = await queue.getJob(event.eventId);
    assert.ok(persisted);
    assert.equal(persisted.data.event.eventId, event.eventId);

    // Three requests were already counted; the next 27 use the remaining quota.
    for (let request = 0; request < 27; request += 1) {
      assert.equal((await post(event)).status, 202);
    }

    const limited = await post(event);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  });
});
