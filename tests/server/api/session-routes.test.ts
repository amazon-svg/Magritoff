import { describe, expect, it, vi } from 'vitest';
import { parseId, type UserId } from '../../../src/kernel';
import {
  SessionApiClient,
  SessionService,
  type SessionRepository,
} from '../../../src/modules/session';
import { FetchApiClient } from '../../../src/platform/api';
import { createApiV1Application, createSessionRoutes } from '../../../src/server/api';

describe('routes session API v1', () => {
  it('partage le contrat bootstrap entre handler et client', async () => {
    const repository = repositoryStub();
    const handler = createApiV1Application({
      routes: createSessionRoutes(new SessionService(repository)),
      requestIdFactory: () => 'request-af2',
      actorResolver: { async resolve() { return { kind: 'user', userId: id('user-af2') }; } },
    });
    const client = new SessionApiClient(
      new FetchApiClient('https://magrit.test', bridgeTo(handler), () => 'jwt-af2'),
    );

    const session = await client.load();
    const preferences = await client.updatePreferences({ theme: 'dark' });
    const selected = await client.updateCurrentTenant('tenant-af2');

    expect(session.user.id).toBe('user-af2');
    expect(session.tenants[0]).toMatchObject({ id: 'tenant-af2', myRole: 'owner' });
    expect(preferences.theme).toBe('dark');
    expect(selected.last_tenant_id).toBe('tenant-af2');
    expect(repository.updatePreferences).toHaveBeenCalledWith('user-af2', { theme: 'dark' });
  });

  it('refuse le bootstrap sans acteur authentifié', async () => {
    const handler = createApiV1Application({
      routes: createSessionRoutes(new SessionService(repositoryStub())),
      requestIdFactory: () => 'request-af2',
    });

    const response = await handler(new Request('https://magrit.test/api/v1/session'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'identity.authentication_required',
      requestId: 'request-af2',
    });
  });

  it('refuse de sélectionner un tenant inaccessible', async () => {
    const handler = createApiV1Application({
      routes: createSessionRoutes(new SessionService(repositoryStub())),
      requestIdFactory: () => 'request-af2',
      actorResolver: { async resolve() { return { kind: 'user', userId: id('user-af2') }; } },
    });

    const response = await handler(new Request('https://magrit.test/api/v1/session/current-tenant', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'stranger' }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'session.tenant_access_denied' });
  });
});

function repositoryStub(): SessionRepository & Record<'updatePreferences', ReturnType<typeof vi.fn>> {
  return {
    autoAcceptPendingInvitations: vi.fn(async () => undefined),
    listDirectMemberships: vi.fn(async () => [{
      tenant: {
        id: 'tenant-af2',
        slug: 'tenant-af2',
        name: 'Tenant AF2',
        parent_tenant_id: null,
        plan: 'pro',
        is_system_tenant: false,
        settings: {},
        created_at: '2026-08-11T12:00:00.000Z',
      },
      role: 'owner',
      accessScope: 'magrit_full',
      allowedShopIds: [],
      permissions: {},
    }]),
    listChildren: vi.fn(async () => []),
    getPreferences: vi.fn(async () => null),
    updatePreferences: vi.fn(async (_userId, patch) => patch),
    updateLastTenant: vi.fn(async (_userId, tenantId) => ({ last_tenant_id: tenantId })),
  };
}

function bridgeTo(handler: (request: Request) => Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    handler(new Request(input, init))) as typeof fetch;
}

function id(value: string): UserId {
  const parsed = parseId<'UserId'>(value);
  if (!parsed.ok) throw new Error('ID de test invalide');
  return parsed.value;
}
