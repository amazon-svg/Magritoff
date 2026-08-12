import { describe, expect, it, vi } from 'vitest';
import { RolesApiClient } from '../../../src/modules/roles/api/client';
import { FetchApiClient } from '../../../src/platform/api/fetch-api-client';

describe('RolesApiClient', () => {
  it('consomme les routes Roles contractuelles', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
      if (String(input).endsWith('/roles-overview')) return new Response(JSON.stringify({ roles: [], members: [], assignments: [] }));
      if (String(input).endsWith('/roles-detail')) return new Response(JSON.stringify({ roles: [], assignments: [], shops: [], accessScope: 'magrit_full', allowedShopIds: [] }));
      return new Response(JSON.stringify({ active: true, assignmentId: '44444444-4444-4444-8444-444444444444' }));
    });
    const client = new RolesApiClient(new FetchApiClient('', fetchMock as typeof fetch, () => 'token'));
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const userId = '22222222-2222-4222-8222-222222222222';
    const roleId = '33333333-3333-4333-8333-333333333333';
    await client.overview(tenantId);
    await client.userDetail(tenantId, userId);
    await client.setAssignment(tenantId, userId, roleId, true);
    expect(calls).toEqual([
      `GET /api/v1/tenants/${tenantId}/roles-overview`,
      `GET /api/v1/tenants/${tenantId}/members/${userId}/roles-detail`,
      `PUT /api/v1/tenants/${tenantId}/members/${userId}/roles/${roleId}`,
    ]);
  });
});
