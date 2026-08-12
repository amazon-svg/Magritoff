import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { fixedClock, parseId, type TenantId, type UserId } from '../../../src/kernel';
import { createApiV1Application, createApiV1Handler, defineJsonRoute } from '../../../src/server/api';

const requestIdFactory = () => 'request-af1';

describe('handler API v1', () => {
  it('expose le healthcheck public avec un request ID corrélé', async () => {
    const handler = createApiV1Application({
      clock: fixedClock('2026-08-11T12:00:00.000Z'),
      requestIdFactory,
    });

    const response = await handler(new Request('https://magrit.test/api/v1/health'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('request-af1');
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      apiVersion: 'v1',
      timestamp: '2026-08-11T12:00:00.000Z',
    });
  });

  it('distingue une route inconnue et une méthode non autorisée', async () => {
    const handler = createApiV1Application({ requestIdFactory });

    const missing = await handler(new Request('https://magrit.test/api/v1/missing'));
    const wrongMethod = await handler(
      new Request('https://magrit.test/api/v1/health', { method: 'POST' }),
    );

    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: 'api.not_found' });
    expect(wrongMethod.status).toBe(405);
    expect(await wrongMethod.json()).toMatchObject({ code: 'api.method_not_allowed' });
  });

  it('bloque une route protégée avant son handler quand aucun acteur n est résolu', async () => {
    const handle = vi.fn(async () => ({ status: 200, body: { ok: true } }));
    const route = defineJsonRoute({
      method: 'GET',
      path: '/api/v1/tenants/{tenantId}/probe',
      authentication: 'required',
      inputSchema: null,
      outputSchema: z.object({ ok: z.boolean() }),
      handle,
    });
    const handler = createApiV1Handler({ routes: [route], requestIdFactory });

    const response = await handler(
      new Request('https://magrit.test/api/v1/tenants/tenant%201/probe'),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: 'identity.authentication_required',
      requestId: 'request-af1',
    });
    expect(handle).not.toHaveBeenCalled();
  });

  it('transmet les paramètres décodés et le contexte acteur au cas d usage', async () => {
    const route = defineJsonRoute({
      method: 'GET',
      path: '/api/v1/tenants/{tenantId}/probe',
      authentication: 'required',
      inputSchema: null,
      outputSchema: z.object({ tenant: z.string(), actorKind: z.string() }),
      async handle(context) {
        return {
          status: 200,
          body: {
            tenant: context.params.tenantId ?? '',
            actorKind: context.actor?.kind ?? 'none',
          },
        };
      },
    });
    const handler = createApiV1Handler({
      routes: [route],
      requestIdFactory,
      actorResolver: {
        async resolve() {
          return {
            kind: 'user',
            userId: id<'UserId'>('user-1') as UserId,
            tenantId: id<'TenantId'>('tenant 1') as TenantId,
          };
        },
      },
    });

    const response = await handler(
      new Request('https://magrit.test/api/v1/tenants/tenant%201/probe'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tenant: 'tenant 1', actorKind: 'user' });
  });

  it('retourne les erreurs de validation sans appeler le handler', async () => {
    const handle = vi.fn(async (_context, input: { name: string }) => ({
      status: 201,
      body: input,
    }));
    const route = defineJsonRoute({
      method: 'POST',
      path: '/api/v1/probe',
      authentication: 'public',
      inputSchema: z.object({ name: z.string().min(2) }),
      outputSchema: z.object({ name: z.string() }),
      handle,
    });
    const handler = createApiV1Handler({ routes: [route], requestIdFactory });

    const response = await handler(
      new Request('https://magrit.test/api/v1/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: 'api.validation_failed',
      errors: [{ field: 'name' }],
    });
    expect(handle).not.toHaveBeenCalled();
  });

  it('masque les détails des exceptions inattendues', async () => {
    const onUnexpectedError = vi.fn();
    const route = defineJsonRoute({
      method: 'GET',
      path: '/api/v1/failure',
      authentication: 'public',
      inputSchema: null,
      outputSchema: z.object({ ok: z.boolean() }),
      async handle() {
        throw new Error('secret interne');
      },
    });
    const handler = createApiV1Handler({
      routes: [route],
      requestIdFactory,
      onUnexpectedError,
    });

    const response = await handler(new Request('https://magrit.test/api/v1/failure'));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain('api.internal_error');
    expect(body).not.toContain('secret interne');
    expect(onUnexpectedError).toHaveBeenCalledOnce();
  });

  it('versionne le contrat OpenAPI de référence', () => {
    const contract = readFileSync(
      resolve(process.cwd(), 'docs/architecture/api/openapi.yaml'),
      'utf8',
    );

    expect(contract).toContain('openapi: 3.1.0');
    expect(contract).toContain('operationId: getApiHealth');
    expect(contract).toContain('operationId: testAiProvider');
    expect(contract).toContain('operationId: testClariprint');
    expect(contract).toContain('AiProviderDiagnostic:');
    expect(contract).toContain('ApiProblem:');
  });
});

function id<Name extends string>(value: string) {
  const result = parseId<Name>(value);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
