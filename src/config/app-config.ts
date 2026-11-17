export type AppEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  environment: AppEnvironment;
  port: number;
  corsOrigins: string[];
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

export function loadAppConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const configuredEnvironment = environment.NODE_ENV ?? 'development';

  if (!validEnvironments.includes(configuredEnvironment as AppEnvironment)) {
    throw new Error(
      `NODE_ENV must be one of: ${validEnvironments.join(', ')}.`,
    );
  }

  return {
    environment: configuredEnvironment as AppEnvironment,
    port: parsePort(environment.PORT),
    corsOrigins: parseCorsOrigins(environment.CORS_ORIGINS),
  };
}
