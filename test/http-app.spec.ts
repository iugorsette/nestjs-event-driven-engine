import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { INestApplication, Module } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { loadAppConfig } from '../src/config/app-config';
import { createApp } from '../src/create-app';

@Module({ imports: [AppModule] })
class TestAppModule {}

describe('HTTP application', () => {
  let app: INestApplication;
  let baseUrl: string;

  before(async () => {
    app = await createApp(
      loadAppConfig({ NODE_ENV: 'test' }),
      false,
      TestAppModule,
    );
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('returns health status and a server-generated request ID', async () => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.match(
      response.headers.get('x-request-id') ?? '',
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('applies security headers to HTTP responses', async () => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('x-frame-options'));
  });

  it('rejects JSON request bodies larger than 256 KiB', async () => {
    const bodyAboveLimit = JSON.stringify({ data: 'x'.repeat(260 * 1024) });
    const response = await fetch(`${baseUrl}/health`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: bodyAboveLimit,
    });

    assert.equal(response.status, 413);
  });

  it('parses a JSON body at the exact 256 KiB boundary', async () => {
    const prefix = '{"payload":"';
    const suffix = '"}';
    const body = `${prefix}${'x'.repeat(256 * 1024 - prefix.length - suffix.length)}${suffix}`;

    const response = await fetch(`${baseUrl}/health`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

    assert.equal(response.status, 404);
  });
});
