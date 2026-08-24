import { describe, expect, it, vi } from 'vitest';
import { MembersApiClient } from '@/modules/members/api/client';
import { FetchApiClient } from '@/platform/api/fetch-api-client';

describe('MembersApiClient', () => {
  it('utilise uniquement les routes API membres', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
      if (init?.method === 'GET') return new Response('[]');
      if (init?.method === 'DELETE') return new Response('{"removed":true}');
      return new Response('{"updated":true}');
    });
    const client = new MembersApiClient(new FetchApiClient('', fetchMock as typeof fetch, () => 'token'));
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const userId = '22222222-2222-4222-8222-222222222222';
    await client.list(tenantId);
    await client.changeRole(tenantId, userId, { role: 'admin' });
    await client.updateAccess(tenantId, userId, { accessScope: 'magrit_full', allowedShopIds: [], permissions: { canQuote: true, canOrder: true, canInvite: false } });
    await client.remove(tenantId, userId);
    expect(calls).toEqual([
      `GET /api/v1/tenants/${tenantId}/members`,
      `PATCH /api/v1/tenants/${tenantId}/members/${userId}/role`,
      `PATCH /api/v1/tenants/${tenantId}/members/${userId}/access`,
      `DELETE /api/v1/tenants/${tenantId}/members/${userId}`,
    ]);
  });
});
