import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { loadAppConfig } from '../../src/config/app-config';
import { RedisThrottlerStorage } from '../../src/security/rate-limiting/redis-throttler-storage';

describe('Redis throttler storage integration', () => {
  const config = loadAppConfig();
  const storage = new RedisThrottlerStorage(config.redis);

  before(async () => {
    await storage.onModuleInit();
  });

  after(() => {
    storage.onModuleDestroy();
  });

  it('keeps concurrent increments atomic and stops incrementing while blocked', async () => {
    const tracker = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        storage.increment(tracker, 10_000, 5, 1_000, 'concurrency'),
      ),
    );

    const admitted = results.filter((result) => !result.isBlocked);
    const blocked = results.filter((result) => result.isBlocked);

    assert.equal(admitted.length, 5);
    assert.deepEqual(
      admitted.map((result) => result.totalHits).sort((a, b) => a - b),
      [1, 2, 3, 4, 5],
    );
    assert.equal(blocked.length, 15);
    assert.ok(blocked.every((result) => result.totalHits === 6));
  });

  it('starts a new fixed window after the counter TTL expires', async () => {
    const tracker = randomUUID();
    const first = await storage.increment(
      tracker,
      500,
      100,
      100,
      'window-expiration',
    );
    const second = await storage.increment(
      tracker,
      500,
      100,
      100,
      'window-expiration',
    );

    await new Promise((resolve) => setTimeout(resolve, 650));
    const afterExpiration = await storage.increment(
      tracker,
      500,
      100,
      100,
      'window-expiration',
    );

    assert.equal(first.totalHits, 1);
    assert.equal(second.totalHits, 2);
    assert.equal(afterExpiration.totalHits, 1);
  });

  it('fails closed when Redis becomes unavailable after startup', async () => {
    storage.onModuleDestroy();

    await assert.rejects(
      storage.increment(randomUUID(), 1_000, 10, 1_000, 'redis-outage'),
      (error: unknown) => error instanceof ServiceUnavailableException,
    );
  });
});
