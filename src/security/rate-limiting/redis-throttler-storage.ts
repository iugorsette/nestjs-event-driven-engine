import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Redis, { RedisOptions } from 'ioredis';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

interface RedisWithThrottleCommand extends Redis {
  incrementThrottle(
    hitsKey: string,
    blockedKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<number[]>;
}

function loadIncrementThrottleScript(): string {
  const relativePath = join('scripts', 'increment-throttle.lua');
  const compiledPath = join(__dirname, relativePath);
  const sourcePath = join(
    process.cwd(),
    'src',
    'security',
    'rate-limiting',
    relativePath,
  );
  const scriptPath = existsSync(compiledPath) ? compiledPath : sourcePath;

  return readFileSync(scriptPath, 'utf8');
}

const incrementScript = loadIncrementThrottleScript();

@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleInit, OnModuleDestroy
{
  private readonly redis: RedisWithThrottleCommand;

  constructor(options: RedisOptions) {
    const redis = new Redis(options);
    redis.defineCommand('incrementThrottle', {
      numberOfKeys: 2,
      lua: incrementScript,
    });
    this.redis = redis as RedisWithThrottleCommand;
  }

  async onModuleInit(): Promise<void> {
    if (this.redis.status === 'ready') return;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.redis.off('ready', onReady);
        reject(new Error('Redis did not become ready during application startup.'));
      }, 5_000);
      const onReady = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.redis.once('ready', onReady);
    });
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
      const result = await this.redis.incrementThrottle(
        `${keyPrefix}:hits`,
        `${keyPrefix}:blocked`,
        ttl,
        limit,
        blockDuration,
      );

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

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
