import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createGescomApiHandler, defineGescomRoute } from '@/server/api/gescom-middleware';
import { InMemoryIdempotencyStore } from '@/modules/_shared/application';
import { withAuthenticatedPostgresRequest, authenticatedPostgresRequest } from '@/adapters/postgres/authenticated-request-context';
import type { TenantId, UserId } from '@/kernel';
const tenantId = '10000000-0000-4000-8000-000000000001' as TenantId;
const userId = '20000000-0000-4000-8000-000000000001' as UserId;

describe('identité PostgreSQL de la façade HTTP', () => {
  function setup() {
    const wrapped = vi.fn();
    const handler = createGescomApiHandler({
      routes: [defineGescomRoute({ method: 'GET', path: '/request-context-tests', operationId: 'requestContextTest', authentication: 'user', inputSchema: null, dataSchema: z.object({ userId: z.string(), tenantId: z.string() }),
        async handle() { const context = authenticatedPostgresRequest()!; return { status: 200, data: context }; } })],
      principalVerifier: { async verify(credential) { return credential.kind === 'bearer' && credential.token === 'valid' ? { kind: 'user', tenantId, userId } : null; } },
      idempotencyStore: new InMemoryIdempotencyStore(),
      runInRequestContext(context, operation) {
        wrapped(context.principal);
        if (context.principal.kind !== 'user') throw new Error('Utilisateur requis');
        return withAuthenticatedPostgresRequest({ tenantId: context.tenantId, userId: context.principal.userId }, operation);
      },
    });
    return { handler, wrapped };
  }
  it('porte seulement l’identité résolue et ne conserve rien après la réponse', async () => {
    const { handler, wrapped } = setup();
    const response = await handler(new Request('https://magrit.test/api/v1/request-context-tests', { headers: { Authorization: 'Bearer valid' } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { userId, tenantId } });
    expect(wrapped).toHaveBeenCalledOnce();
    expect(authenticatedPostgresRequest()).toBeUndefined();
  });
  it.each([undefined, 'Bearer invalid'])('n’installe aucun contexte sans authentification valide (%s)', async authorization => {
    const { handler, wrapped } = setup();
    const response = await handler(new Request('https://magrit.test/api/v1/request-context-tests', { headers: authorization ? { Authorization: authorization } : {} }));
    expect(response.status).toBe(401);
    expect(wrapped).not.toHaveBeenCalled();
    expect(authenticatedPostgresRequest()).toBeUndefined();
  });
});
