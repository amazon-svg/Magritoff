import { describe, expect, it, vi } from 'vitest';
import { createApiV1Application } from '../../../src/server/api/composition.ts';
import { createReadinessRoute } from '../../../src/server/api/readiness-route.ts';

describe('GET /api/v1/readiness', () => {
  it('rend ready quand PostgreSQL repond', async () => {
    const check = vi.fn().mockResolvedValue(undefined);
    const handler = createApiV1Application({
      routes: [createReadinessRoute({ check })],
      requestIdFactory: () => 'req-ready',
    });

    const response = await handler(new Request('http://localhost/api/v1/readiness'));

    expect(response.status).toBe(200);
    expect(check).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      status: 'ready',
      checks: { postgres: 'ready' },
    });
  });

  it('rend 503 sans detail interne quand PostgreSQL ne repond pas', async () => {
    const handler = createApiV1Application({
      routes: [createReadinessRoute({ check: vi.fn().mockRejectedValue(new Error('secret')) })],
      requestIdFactory: () => 'req-not-ready',
    });

    const response = await handler(new Request('http://localhost/api/v1/readiness'));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    await expect(response.json()).resolves.toEqual({
      status: 'not_ready',
      checks: { postgres: 'unavailable' },
    });
  });
});
