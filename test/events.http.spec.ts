import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { APP_GUARD } from '@nestjs/core';
import { Module, ServiceUnavailableException } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { createApp } from '../src/create-app';
import { APP_CONFIG, loadAppConfig } from '../src/config/app-config';
import {
  EVENT_ADMISSION_PORT,
  EventAdmissionDecision,
  EventAdmissionPort,
  EventAdmissionUnavailableError,
} from '../src/events/application/event-admission.port';
import { AdmitEventUseCase } from '../src/events/application/admit-event.use-case';
import { EventsController } from '../src/events/events.controller';
import { IngestEventDto } from '../src/events/dto/ingest-event.dto';
import { classifyEventSubmission } from '../src/events/event-fingerprint';
import { ProducerApiKeyGuard } from '../src/security/producer-api-key.guard';

const apiKey = 'portfolio-test-key-0123456789abcdef0123456789abcdef';
const config = loadAppConfig({ NODE_ENV: 'test', INGEST_API_KEY: apiKey });

class TestThrottleStorage implements ThrottlerStorage {
  private readonly counters = new Map<
    string,
    { totalHits: number; expiresAt: number; blockedUntil: number }
  >();
  unavailable = false;

  reset(): void {
    this.counters.clear();
    this.unavailable = false;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    if (this.unavailable) {
      throw new ServiceUnavailableException('simulated rate-limit outage');
    }

    const storageKey = `${throttlerName}:${key}`;
    const now = Date.now();
    let counter = this.counters.get(storageKey);

    if (!counter || counter.expiresAt <= now) {
      counter = { totalHits: 0, expiresAt: now + ttl, blockedUntil: 0 };
      this.counters.set(storageKey, counter);
    }

    if (counter.blockedUntil > now) {
      return {
        totalHits: counter.totalHits,
        timeToExpire: Math.ceil((counter.expiresAt - now) / 1_000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil((counter.blockedUntil - now) / 1_000),
      };
    }

    counter.totalHits += 1;
    if (counter.totalHits > limit) counter.blockedUntil = now + blockDuration;

    return {
      totalHits: counter.totalHits,
      timeToExpire: Math.ceil((counter.expiresAt - now) / 1_000),
      isBlocked: counter.blockedUntil > now,
      timeToBlockExpire: Math.max(
        0,
        Math.ceil((counter.blockedUntil - now) / 1_000),
      ),
    };
  }
}

class InMemoryEventAdmission implements EventAdmissionPort {
  readonly jobs = new Map<string, string>();
  addCalls = 0;
  available = true;

  async admit(
    event: IngestEventDto,
    fingerprint: string,
  ): Promise<EventAdmissionDecision> {
    if (!this.available) throw new EventAdmissionUnavailableError();

    const existingFingerprint = this.jobs.get(event.eventId);
    if (existingFingerprint) {
      return classifyEventSubmission(event, existingFingerprint) === 'duplicate'
        ? 'duplicate'
        : 'conflict';
    }

    this.jobs.set(event.eventId, fingerprint);
    this.addCalls += 1;
    return 'accepted';
  }
}

const throttleStorage = new TestThrottleStorage();
const admission = new InMemoryEventAdmission();

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      storage: throttleStorage,
    }),
  ],
  controllers: [EventsController],
  providers: [
    AdmitEventUseCase,
    ProducerApiKeyGuard,
    { provide: APP_CONFIG, useValue: config },
    { provide: EVENT_ADMISSION_PORT, useValue: admission },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
class IngestionHttpTestModule {}

const event: IngestEventDto = {
  eventId: '5fd55d2a-4506-4cd5-9314-2f0a00a43167',
  eventType: 'order.created',
  schemaVersion: 1,
  occurredAt: '2026-11-17T12:30:00Z',
  payload: { orderId: 'ord-http-test', totalCents: 4200 },
};

describe('POST /events', () => {
  let baseUrl: string;
  let app: Awaited<ReturnType<typeof createApp>>;

  async function postEvent(
    body: unknown = event,
    authorization: string | null = `Bearer ${apiKey}`,
  ): Promise<Response> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (authorization !== null) headers.authorization = authorization;
    return fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  before(async () => {
    throttleStorage.reset();
    admission.available = true;
    admission.jobs.clear();
    admission.addCalls = 0;
    app = await createApp(config, false, IngestionHttpTestModule);
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('returns 202 for accepted events and identical retries without re-enqueueing', async () => {
    const first = await postEvent();
    const retry = await postEvent();

    assert.equal(first.status, 202);
    assert.deepEqual(await first.json(), { eventId: event.eventId, status: 'accepted' });
    assert.equal(retry.status, 202);
    assert.equal(admission.addCalls, 1);
  });

  it('returns 409 when an event ID is reused with different content', async () => {
    const response = await postEvent({
      ...event,
      payload: { orderId: 'different-order' },
    });

    assert.equal(response.status, 409);
  });

  it('requires a valid producer bearer key', async () => {
    assert.equal((await postEvent(event, null)).status, 401);
    assert.equal((await postEvent(event, 'Bearer invalid')).status, 401);
  });

  it('rejects DTO properties outside the allowlist', async () => {
    const response = await postEvent({ ...event, producerId: 'untrusted' });

    assert.equal(response.status, 400);
  });

  it('returns 503 when event admission is unavailable', async () => {
    admission.available = false;
    const response = await postEvent({ ...event, eventId: 'a5c2eaf9-449a-48a8-91ce-f2447b843f6b' });
    admission.available = true;

    assert.equal(response.status, 503);
  });

  it('fails closed with 503 if rate-limit storage is unavailable', async () => {
    throttleStorage.unavailable = true;
    const response = await postEvent({ ...event, eventId: 'f25d9b51-717d-4629-a117-62fa7bb6dc2a' });
    throttleStorage.unavailable = false;

    assert.equal(response.status, 503);
  });

  it('returns 429 after the route limit of 30 requests per minute', async () => {
    // Keep this assertion independent from the requests in the other cases.
    throttleStorage.reset();
    for (let request = 0; request < 30; request += 1) {
      assert.equal((await postEvent()).status, 202);
    }

    const limited = await postEvent();
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  });
});
