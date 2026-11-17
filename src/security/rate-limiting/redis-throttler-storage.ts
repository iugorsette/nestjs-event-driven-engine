import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import Redis, { RedisOptions } from 'ioredis';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const incrementScript = `
local blockedTtl = redis.call('PTTL', KEYS[2])
if blockedTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  local hitsTtl = math.max(redis.call('PTTL', KEYS[1]), 0)
  return { hits, hitsTtl, 1, blockedTtl }
end

local hits = redis.call('INCR', KEYS[1])
local hitsTtl = redis.call('PTTL', KEYS[1])
if hits == 1 or hitsTtl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  hitsTtl = tonumber(ARGV[1])
end

local isBlocked = 0
local timeToBlockExpire = 0
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  isBlocked = 1
  timeToBlockExpire = tonumber(ARGV[3])
end

return { hits, hitsTtl, isBlocked, timeToBlockExpire }
`;

@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly redis: Redis;

  constructor(options: RedisOptions) {
    this.redis = new Redis(options);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const digest = createHash('sha256')
      .update(`${throttlerName}:${key}`)
      .digest('hex');
    const keyPrefix = `hteda:throttle:{${digest}}`;

    try {
      const result = (await this.redis.eval(
        incrementScript,
        2,
        `${keyPrefix}:hits`,
        `${keyPrefix}:blocked`,
        ttl,
        limit,
        blockDuration,
      )) as number[];

      if (!Array.isArray(result) || result.length !== 4) {
        throw new Error('Redis returned an invalid throttle record.');
      }

      const [totalHits, ttlRemainingMs, blocked, blockRemainingMs] = result;
      return {
        totalHits,
        timeToExpire: Math.ceil(Math.max(ttlRemainingMs, 0) / 1_000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(Math.max(blockRemainingMs, 0) / 1_000),
      };
    } catch {
      // Fail closed: without shared rate-limit state, do not admit the request.
      throw new ServiceUnavailableException('Rate-limit storage is unavailable.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
      return;
    }

    this.redis.disconnect();
  }
}
