import { describe, expect, it, vi } from 'vitest';
import { parseId, type UserId } from '../../../src/kernel';
import {
  SessionApiClient,
  SessionService,
  SessionTenantMutationError,
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
    const resolvedSlug = await client.resolveTenantSlug('ancien-espace');
    const preferences = await client.updatePreferences({ theme: 'dark' });
    const selected = await client.updateCurrentTenant('tenant-af2');
    await client.updateTenantSettings('tenant-af2', { name: 'Nouveau nom' });
    const dashboard = await client.subTenantsDashboard('tenant-af2');
    const childId = await client.createSubTenant('tenant-af2', { name: 'Filiale AF15', slug: 'filiale-af15' });
    await client.removeSubTenant('tenant-af2', childId);

    expect(session.user.id).toBe('user-af2');
    expect(resolvedSlug).toBe('tenant-af2');
    expect(session.tenants[0]).toMatchObject({ id: 'tenant-af2', myRole: 'owner' });
    expect(preferences.theme).toBe('dark');
    expect(selected.last_tenant_id).toBe('tenant-af2');
    expect(repository.updatePreferences).toHaveBeenCalledWith('user-af2', { theme: 'dark' });
    expect(repository.updateTenantSettings).toHaveBeenCalledWith('user-af2', 'tenant-af2', { name: 'Nouveau nom' });
    expect(dashboard.subTenants[0]).toMatchObject({ id: 'subtenant-af15', slug: 'filiale-af15' });
    expect(repository.createSubTenant).toHaveBeenCalledWith('user-af2', 'tenant-af2', { name: 'Filiale AF15', slug: 'filiale-af15' });
    expect(repository.removeSubTenant).toHaveBeenCalledWith('user-af2', 'tenant-af2', 'subtenant-af15');
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

  it('refuse un ancien slug tenant invalide avant le repository', async () => {
    const repository = repositoryStub();
    const handler = createApiV1Application({ routes: createSessionRoutes(new SessionService(repository)), requestIdFactory: () => 'request-af16', actorResolver: { async resolve() { return { kind: 'user', userId: id('user-af2') }; } } });
    const response = await handler(new Request('https://magrit.test/api/v1/tenant-slugs/Slug%20invalide'));
    expect(response.status).toBe(422);
    expect(repository.resolveTenantSlug).not.toHaveBeenCalled();
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

  it('valide le slug tenant avant le repository', async () => {
    const repository = repositoryStub();
    const handler = createApiV1Application({ routes: createSessionRoutes(new SessionService(repository)), requestIdFactory: () => 'request-af15', actorResolver: { async resolve() { return { kind: 'user', userId: id('user-af2') }; } } });
    const response = await handler(new Request('https://magrit.test/api/v1/tenants/tenant-af2', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'Slug invalide' }) }));
    expect(response.status).toBe(422); expect(repository.updateTenantSettings).not.toHaveBeenCalled();
  });

  it('traduit un conflit de slug tenant en 409', async () => {
    const repository = repositoryStub();
    repository.updateTenantSettings.mockRejectedValueOnce(new SessionTenantMutationError('conflict', 'duplicate key'));
    const handler = createApiV1Application({ routes: createSessionRoutes(new SessionService(repository)), requestIdFactory: () => 'request-af15', actorResolver: { async resolve() { return { kind: 'user', userId: id('user-af2') }; } } });
    const response = await handler(new Request('https://magrit.test/api/v1/tenants/tenant-af2', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'slug-utilise' }) }));
    expect(response.status).toBe(409); expect((await response.json()).code).toBe('session.tenant_conflict');
  });

  it('valide la création d un sous-espace avant le repository', async () => {
    const repository = repositoryStub();
    const handler = createApiV1Application({ routes: createSessionRoutes(new SessionService(repository)), requestIdFactory: () => 'request-af15', actorResolver: { async resolve() { return { kind: 'user', userId: id('user-af2') }; } } });
    const response = await handler(new Request('https://magrit.test/api/v1/tenants/tenant-af2/subtenants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Filiale', slug: 'NON VALIDE' }) }));
    expect(response.status).toBe(422);
    expect(repository.createSubTenant).not.toHaveBeenCalled();
  });

  it('traduit un sous-espace absent en 404', async () => {
    const repository = repositoryStub();
    repository.removeSubTenant.mockRejectedValueOnce(new SessionTenantMutationError('not_found', 'absent'));
    const handler = createApiV1Application({ routes: createSessionRoutes(new SessionService(repository)), requestIdFactory: () => 'request-af15', actorResolver: { async resolve() { return { kind: 'user', userId: id('user-af2') }; } } });
    const response = await handler(new Request('https://magrit.test/api/v1/tenants/tenant-af2/subtenants/subtenant-absent', { method: 'DELETE' }));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('session.tenant_not_found');
  });
});

function repositoryStub(): SessionRepository & Record<'resolveTenantSlug' | 'updatePreferences' | 'updateTenantSettings' | 'createSubTenant' | 'removeSubTenant', ReturnType<typeof vi.fn>> {
  return {
    resolveTenantSlug: vi.fn(async () => 'tenant-af2'),
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
    updateTenantSettings: vi.fn(async () => undefined),
    subTenantsDashboard: vi.fn(async () => ({
      subTenants: [{ id: 'subtenant-af15', slug: 'filiale-af15', name: 'Filiale AF15', createdAt: '2026-08-12T12:00:00.000Z' }],
      kpis: [{ tenantId: 'subtenant-af15', tenantName: 'Filiale AF15', tenantSlug: 'filiale-af15', createdAt: '2026-08-12T12:00:00.000Z', memberCount: 2, monthOrderCount: 3, monthCaHt: 450 }],
    })),
    createSubTenant: vi.fn(async () => 'subtenant-af15'),
    removeSubTenant: vi.fn(async () => undefined),
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
