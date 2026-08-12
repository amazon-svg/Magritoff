import { describe, expect, it, vi } from 'vitest';
import { RolesApiClient } from '../../../src/modules/roles/api/client';
import { FetchApiClient } from '../../../src/platform/api/fetch-api-client';

describe('RolesApiClient', () => {
  it('consomme les routes Roles contractuelles', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
      if (String(input).includes('/capabilities/')) return new Response(JSON.stringify({ capability: 'can_validate', granted: true }));
      if (String(input).endsWith('/roles-overview')) return new Response(JSON.stringify({ roles: [], members: [], assignments: [] }));
      if (String(input).endsWith('/roles-catalog')) return new Response(JSON.stringify({ roles: [], members: [], assignments: [] }));
      if (String(input).endsWith('/roles-detail')) return new Response(JSON.stringify({ roles: [], assignments: [], shops: [], accessScope: 'magrit_full', allowedShopIds: [] }));
      if (String(input).endsWith('/roles-order')) return new Response(JSON.stringify({ reordered: true }));
      if (init?.method === 'DELETE') return new Response(JSON.stringify({ archived: true }));
      if (String(input).endsWith('/roles') || (init?.method === 'PUT' && !String(input).includes('/members/') && String(input).endsWith(`/roles/${roleId}`))) return new Response(JSON.stringify({
        id: roleId, tenantId, name: 'Validateur', description: '', capabilities: { can_validate: true },
        notifyPolicy: 'chain_next', scope: 'tenant', scopeShopId: null, orderingIndex: 40, archivedAt: null,
      }));
      return new Response(JSON.stringify({ active: true, assignmentId: '44444444-4444-4444-8444-444444444444' }));
    });
    const client = new RolesApiClient(new FetchApiClient('', fetchMock as typeof fetch, () => 'token'));
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const userId = '22222222-2222-4222-8222-222222222222';
    const roleId = '33333333-3333-4333-8333-333333333333';
    const command = { name: 'Validateur', description: '', capabilities: { can_validate: true }, notifyPolicy: 'chain_next' as const, scope: 'tenant' as const, scopeShopId: null, orderingIndex: 40 };
    expect(await client.userCapability(tenantId, 'can_validate')).toBe(true);
    await client.overview(tenantId);
    await client.catalog(tenantId);
    await client.userDetail(tenantId, userId);
    await client.setAssignment(tenantId, userId, roleId, true);
    await client.createDefinition(tenantId, command);
    await client.updateDefinition(tenantId, roleId, command);
    await client.reorderDefinitions(tenantId, roleId, '44444444-4444-4444-8444-444444444444');
    await client.archiveDefinition(tenantId, roleId);
    expect(calls).toEqual([
      `GET /api/v1/tenants/${tenantId}/capabilities/can_validate`,
      `GET /api/v1/tenants/${tenantId}/roles-overview`,
      `GET /api/v1/tenants/${tenantId}/roles-catalog`,
      `GET /api/v1/tenants/${tenantId}/members/${userId}/roles-detail`,
      `PUT /api/v1/tenants/${tenantId}/members/${userId}/roles/${roleId}`,
      `POST /api/v1/tenants/${tenantId}/roles`,
      `PUT /api/v1/tenants/${tenantId}/roles/${roleId}`,
      `PUT /api/v1/tenants/${tenantId}/roles-order`,
      `DELETE /api/v1/tenants/${tenantId}/roles/${roleId}`,
    ]);
  });
});
