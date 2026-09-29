import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../../../src/kernel/clock/index.ts';
import { createApiV1Application } from '../../../src/server/api/composition.ts';
import { createNodeHttpServer } from '../../../src/server/node/http-server.ts';

const servers: ReturnType<typeof createNodeHttpServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe('serveur HTTP Node', () => {
  it('sert le healthcheck de l application Fetch sans dependance Supabase', async () => {
    const app = createApiV1Application({
      clock: fixedClock('2026-09-29T12:00:00.000Z'),
      requestIdFactory: () => 'req-node-health',
    });
    const server = createNodeHttpServer(app);
    servers.push(server);
    await listen(server);

    const response = await fetch(`${origin(server)}/api/v1/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req-node-health');
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      apiVersion: 'v1',
      timestamp: '2026-09-29T12:00:00.000Z',
    });
  });

  it('transmet un corps de requete en flux au handler Fetch', async () => {
    const server = createNodeHttpServer(async (request) => Response.json({
      method: request.method,
      body: await request.text(),
    }));
    servers.push(server);
    await listen(server);

    const response = await fetch(`${origin(server)}/echo`, {
      method: 'POST',
      body: 'bonjour',
    });

    await expect(response.json()).resolves.toEqual({ method: 'POST', body: 'bonjour' });
  });

  it('convertit une panne du transport en probleme HTTP sans exposer son detail', async () => {
    const errors: unknown[] = [];
    const server = createNodeHttpServer(
      async () => { throw new Error('secret interne'); },
      { onUnhandledError: (error) => errors.push(error) },
    );
    servers.push(server);
    await listen(server);

    const response = await fetch(`${origin(server)}/failure`);

    expect(response.status).toBe(500);
    expect(errors).toHaveLength(1);
    await expect(response.json()).resolves.toEqual({
      type: 'about:blank',
      title: 'Erreur interne',
      status: 500,
      code: 'api.transport_error',
    });
  });
});

async function listen(server: ReturnType<typeof createNodeHttpServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

function origin(server: ReturnType<typeof createNodeHttpServer>): string {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}
