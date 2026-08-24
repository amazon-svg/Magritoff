import { describe, expect, it, vi } from 'vitest';
import { InvitationsApiClient } from '../../../src/modules/invitations/api/client';
import { FetchApiClient } from '../../../src/platform/api/fetch-api-client';

const command = {
  email: 'buyer@example.com',
  tenantId: '11111111-1111-4111-8111-111111111111',
  baseUrl: 'http://localhost:5177',
  role: 'member' as const,
  roleDefinitionIds: ['33333333-3333-4333-8333-333333333333'],
};

describe('InvitationsApiClient', () => {
  it('envoie la commande au endpoint API v1 authentifié', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fresh-token');
      expect(JSON.parse(String(init?.body))).toEqual(command);
      return new Response(JSON.stringify({
        invitationId: '44444444-4444-4444-8444-444444444444',
        sent: true,
        link: 'http://localhost:5177/invitations/token',
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    });
    const client = new InvitationsApiClient(new FetchApiClient('', fetchMock as typeof fetch, () => 'fresh-token'));

    await expect(client.create(command)).resolves.toMatchObject({ sent: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/invitations', expect.any(Object));
  });

  it('expose les opérations d’administration sans fournisseur', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (path.endsWith('/invitation-options')) return new Response(JSON.stringify({ roles: [], shops: [] }));
      if (path.endsWith('/invitations') && init?.method === 'GET') return new Response('[]');
      if (path.endsWith('/resend')) return new Response(JSON.stringify({ sent: false, link: 'http://localhost:5177/invitations/token' }));
      return new Response(JSON.stringify({ revoked: true }));
    });
    const client = new InvitationsApiClient(new FetchApiClient('', fetchMock as typeof fetch, () => 'token'));
    const tenantId = command.tenantId;
    const invitationId = '44444444-4444-4444-8444-444444444444';

    await client.options(tenantId);
    await client.pending(tenantId);
    await client.resend(invitationId, command.baseUrl);
    await client.revoke(invitationId);

    expect(calls).toEqual([
      `GET /api/v1/tenants/${tenantId}/invitation-options`,
      `GET /api/v1/tenants/${tenantId}/invitations`,
      `POST /api/v1/invitations/${invitationId}/resend`,
      `DELETE /api/v1/invitations/${invitationId}`,
    ]);
  });
});
