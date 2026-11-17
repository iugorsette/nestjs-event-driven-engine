import { RedisOptions } from 'ioredis';

export type AppEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  environment: AppEnvironment;
  port: number;
  corsOrigins: string[];
  redis: RedisOptions;
}

const validEnvironments: AppEnvironment[] = [
  'development',
  'test',
  'production',
];

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return 3000;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') {
    return [];
  }

  return value.split(',').map((entry) => {
    const origin = entry.trim();
    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGINS contains an invalid origin: "${origin}".`);
    }

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) {
      throw new Error(
        `CORS_ORIGINS entries must be HTTP(S) origins without paths: "${origin}".`,
      );
    }

    return parsed.origin;
  });
}

function parseRedisUrl(
  value: string | undefined,
  appEnvironment: AppEnvironment,
): RedisOptions {
  const redisUrl = value ?? 'redis://localhost:6379/0';
  let parsed: URL;

  try {
    parsed = new URL(redisUrl);
  } catch {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.');
  }

  if (
    !['redis:', 'rediss:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    !/^\/?\d*$/.test(parsed.pathname)
  ) {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.');
  }

  if (appEnvironment === 'production' && parsed.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use TLS (rediss://) in production.');
  }

  const database = parsed.pathname.replace(/^\//, '');
  const port = parsed.port === '' ? 6379 : Number(parsed.port);
  const db = database === '' ? 0 : Number(database);

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isSafeInteger(db) ||
    db < 0
  ) {
    throw new Error('REDIS_URL contains an invalid port or database number.');
  }

  return {
    host: parsed.hostname,
    port,
    db,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

export function loadAppConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const configuredEnvironment = environment.NODE_ENV ?? 'development';

  if (!validEnvironments.includes(configuredEnvironment as AppEnvironment)) {
    throw new Error(
      `NODE_ENV must be one of: ${validEnvironments.join(', ')}.`,
    );
  }

  const appEnvironment = configuredEnvironment as AppEnvironment;

  return {
    environment: appEnvironment,
    port: parsePort(environment.PORT),
    corsOrigins: parseCorsOrigins(environment.CORS_ORIGINS),
    redis: parseRedisUrl(environment.REDIS_URL, appEnvironment),
  };
}
