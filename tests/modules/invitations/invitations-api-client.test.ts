import { describe, expect, it, vi } from 'vitest';
import { InvitationsApiClient } from '../../../src/modules/invitations/api/client';
import { FetchApiClient } from '../../../src/platform/api/fetch-api-client';

const command = {
  email: 'buyer@example.com',
  tenantId: '11111111-1111-4111-8111-111111111111',
  baseUrl: 'http://localhost:5177',
  accessScope: 'shop_only' as const,
  allowedShopIds: ['22222222-2222-4222-8222-222222222222'],
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
});
