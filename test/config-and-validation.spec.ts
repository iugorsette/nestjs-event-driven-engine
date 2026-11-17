import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IsString } from 'class-validator';
import { loadAppConfig } from '../src/config/app-config';
import { createGlobalValidationPipe } from '../src/create-app';

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
