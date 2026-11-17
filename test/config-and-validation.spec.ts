import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IsString } from 'class-validator';
import { loadAppConfig } from '../src/config/app-config';
import {
  createGlobalValidationPipe,
  MAX_REQUEST_BODY_BYTES,
} from '../src/create-app';
import { IngestEventDto } from '../src/events/dto/ingest-event.dto';
import {
  classifyEventSubmission,
  fingerprintEvent,
} from '../src/events/event-fingerprint';

class ExampleDto {
  @IsString()
  name!: string;
}

describe('application configuration', () => {
  it('uses development defaults when optional values are absent', () => {
    assert.deepEqual(loadAppConfig({}), {
      environment: 'development',
      port: 3000,
      corsOrigins: [],
    });
  });

  it('parses a port and comma-separated CORS allowlist', () => {
    assert.deepEqual(
      loadAppConfig({
        NODE_ENV: 'production',
        PORT: '8080',
        CORS_ORIGINS: 'https://console.example.com, http://localhost:3001',
      }),
      {
        environment: 'production',
        port: 8080,
        corsOrigins: ['https://console.example.com', 'http://localhost:3001'],
      },
    );
  });

  it('rejects unsupported environments', () => {
    assert.throws(() => loadAppConfig({ NODE_ENV: 'staging' }), /NODE_ENV/);
  });

  it('rejects ports outside the valid integer range', () => {
    for (const port of ['0', '65536', '-1', '3.14', 'abc']) {
      assert.throws(() => loadAppConfig({ PORT: port }), /PORT must be an integer/);
    }
  });

  it('rejects CORS entries that are URLs but not exact HTTP(S) origins', () => {
    for (const origin of [
      'https://example.com/path',
      'ftp://example.com',
      'https://user:password@example.com',
    ]) {
      assert.throws(() => loadAppConfig({ CORS_ORIGINS: origin }), /CORS_ORIGINS/);
    }
  });
});

describe('global DTO validation', () => {
  const pipe = createGlobalValidationPipe();
  const metadata = { type: 'body' as const, metatype: ExampleDto };

  it('transforms plain input into the DTO class', async () => {
    const result = await pipe.transform({ name: 'event' }, metadata);

    assert.ok(result instanceof ExampleDto);
    assert.equal(result.name, 'event');
  });

  it('rejects fields outside the DTO allowlist', async () => {
    await assert.rejects(
      pipe.transform({ name: 'event', isAdmin: true }, metadata),
      { status: 400 },
    );
  });

  it('rejects values with the wrong type', async () => {
    await assert.rejects(pipe.transform({ name: 42 }, metadata), { status: 400 });
  });
});

describe('event ingestion contract', () => {
  const pipe = createGlobalValidationPipe();
  const metadata = { type: 'body' as const, metatype: IngestEventDto };
  const validEvent = {
    eventId: '5fd55d2a-4506-4cd5-9314-2f0a00a43167',
    eventType: 'order.created',
    schemaVersion: 1,
    occurredAt: '2026-11-17T12:30:00Z',
    payload: { orderId: 'ord-123', totalCents: 4200 },
  };

  it('accepts and transforms a versioned event envelope', async () => {
    const result = await pipe.transform(validEvent, metadata);

    assert.ok(result instanceof IngestEventDto);
    assert.equal(result.eventType, 'order.created');
    assert.equal(result.schemaVersion, 1);
  });

  it('rejects unsupported fields and invalid envelope values', async () => {
    await assert.rejects(
      pipe.transform({ ...validEvent, producerId: 'untrusted' }, metadata),
      { status: 400 },
    );
    await assert.rejects(
      pipe.transform({ ...validEvent, eventType: 'Order Created' }, metadata),
      { status: 400 },
    );
    await assert.rejects(
      pipe.transform({ ...validEvent, schemaVersion: 0 }, metadata),
      { status: 400 },
    );
    await assert.rejects(
      pipe.transform({ ...validEvent, occurredAt: '2026-11-17T12:30:00' }, metadata),
      { status: 400 },
    );
    await assert.rejects(
      pipe.transform({ ...validEvent, payload: [] }, metadata),
      { status: 400 },
    );
  });

  it('defines a maximum HTTP JSON body size of 256 KiB', () => {
    assert.equal(MAX_REQUEST_BODY_BYTES, 256 * 1024);
  });

  it('fingerprints equivalent JSON objects independent of key order', () => {
    const reorderedEvent = {
      payload: { totalCents: 4200, orderId: 'ord-123' },
      occurredAt: validEvent.occurredAt,
      schemaVersion: validEvent.schemaVersion,
      eventType: validEvent.eventType,
      eventId: validEvent.eventId,
    } as IngestEventDto;

    assert.equal(
      fingerprintEvent(validEvent as IngestEventDto),
      fingerprintEvent(reorderedEvent),
    );
  });

  it('classifies a retry as new, duplicate, or conflicting by event ID and content', () => {
    const acceptedFingerprint = fingerprintEvent(validEvent as IngestEventDto);

    assert.equal(classifyEventSubmission(validEvent as IngestEventDto), 'new');
    assert.equal(
      classifyEventSubmission(validEvent as IngestEventDto, acceptedFingerprint),
      'duplicate',
    );
    assert.equal(
      classifyEventSubmission(
        { ...validEvent, payload: { ...validEvent.payload, totalCents: 5000 } } as IngestEventDto,
        acceptedFingerprint,
      ),
      'conflict',
    );
  });
});
