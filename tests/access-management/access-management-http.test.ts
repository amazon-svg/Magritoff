import { describe, expect, it, vi } from 'vitest';
import { ok, parseId } from '../../src/kernel';
import { AccessManagementQueries } from '../../src/modules/access-management/application';
import { handleAccessManagementRequest } from '../../src/modules/access-management/infrastructure';
import type { AccessManagementHttpDependencies } from '../../src/modules/access-management/infrastructure';

const tenantId = '11111111-1111-4111-8111-111111111111';

function id<Name extends string>(value: string) {
  const parsed = parseId<Name>(value);
  if (!parsed.ok) throw new Error('Invalid identifier.');
  return parsed.value;
}

function dependencies(): AccessManagementHttpDependencies {
  const userId = id<'UserId'>('33333333-3333-4333-8333-333333333333');
  return {
    identity: {
      verifyToken: vi.fn().mockResolvedValue(ok({
        identity: { id: userId, status: 'active' },
        authenticatedAt: '2026-08-11T12:00:00.000Z',
      })),
      getCurrentIdentity: vi.fn(),
      getIdentity: vi.fn(),
    },
    tenants: {
      get: vi.fn(),
      listMemberships: vi.fn(),
      resolveMembership: vi.fn(),
      requireMembership: vi.fn().mockResolvedValue(ok({
        userId,
        tenantId: id<'TenantId'>(tenantId),
        status: 'active',
      })),
      getHierarchy: vi.fn(),
    },
    queries: new AccessManagementQueries({
      access: {
        can: vi.fn().mockResolvedValue({ allowed: true, reason: 'role' }),
        require: vi.fn().mockResolvedValue(ok(undefined)),
        listCapabilities: vi.fn().mockResolvedValue(ok(['clariprint_data.module.access'])),
      },
      entitlements: {
        hasFeature: vi.fn().mockResolvedValue(ok(true)),
        requireFeature: vi.fn(),
        getLimit: vi.fn(),
        consume: vi.fn(),
      },
      repository: {
        listRoles: vi.fn().mockResolvedValue(ok([])),
        getRole: vi.fn().mockResolvedValue(ok(null)),
        listMemberAssignments: vi.fn().mockResolvedValue(ok([])),
      },
      capabilities: { list: () => [] },
      modules: {
        list: () => [{
          moduleKey: 'clariprint_data',
          feature: 'clariprint_data.enabled',
          accessCapability: 'clariprint_data.module.access',
          capabilities: [],
        }],
      },
    }),
  };
}

function request(path: string, token = 'valid-token', method = 'GET') {
  return new Request(`https://api.example.test${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('access-management HTTP API', () => {
  it('serves the resource-oriented access/me contract', async () => {
    const response = await handleAccessManagementRequest(
      request(`/api/v1/tenants/${tenantId}/access/me`),
      dependencies(),
      { requestId: 'request-http-access' },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Request-Id')).toBe('request-http-access');
    await expect(response.json()).resolves.toMatchObject({
      tenantId,
      membership: 'active',
      modules: [{ moduleKey: 'clariprint_data', accessible: true }],
    });
  });

  it('supports the Edge hosting prefix without exposing it in the contract', async () => {
    const response = await handleAccessManagementRequest(
      request(`/functions/v1/access-management/api/v1/tenants/${tenantId}/access/modules`),
      dependencies(),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ moduleKey: 'clariprint_data' }],
    });
  });

  it('rejects missing authentication and unknown routes before providers are queried', async () => {
    const services = dependencies();
    const unauthenticated = await handleAccessManagementRequest(
      request(`/api/v1/tenants/${tenantId}/access/me`, ''),
      services,
    );
    expect(unauthenticated.status).toBe(401);
    expect(services.identity.verifyToken).not.toHaveBeenCalled();

    const unknown = await handleAccessManagementRequest(
      request(`/api/v1/tenants/${tenantId}/access/unknown`),
      services,
    );
    expect(unknown.status).toBe(404);
  });

  it('only exposes GET in the read increment', async () => {
    const response = await handleAccessManagementRequest(
      request(`/api/v1/tenants/${tenantId}/access/roles`, 'valid-token', 'POST'),
      dependencies(),
    );
    expect(response.status).toBe(405);
  });
});

