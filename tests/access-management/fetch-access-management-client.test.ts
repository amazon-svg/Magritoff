import { describe, expect, it, vi } from 'vitest';
import {
  AccessManagementApiError,
  FetchAccessManagementApiClient,
} from '../../src/modules/access-management/infrastructure';

describe('FetchAccessManagementApiClient', () => {
  it('uses the relative business API and attaches the session token', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tenantId: 'tenant-1',
      userId: 'user-1',
      membership: 'active',
      capabilities: [],
      modules: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = new FetchAccessManagementApiClient(
      async () => 'session-token',
      '/api/v1',
      fetcher,
    );
    await client.getMyTenantAccess('tenant-1');
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/v1/tenants/tenant-1/access/me');
    expect(options.method).toBe('GET');
    expect((options.headers as Headers).get('Authorization')).toBe('Bearer session-token');
  });

  it('maps API failures to a typed error', async () => {
    const client = new FetchAccessManagementApiClient(
      async () => 'session-token',
      '/api/v1',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({
        error: { code: 'access_management.forbidden', message: 'Forbidden', retryable: false },
        requestId: 'request-failure',
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })),
    );
    await expect(client.listRoles('tenant-1')).rejects.toEqual(expect.objectContaining({
      name: 'AccessManagementApiError',
      code: 'access_management.forbidden',
      status: 403,
      requestId: 'request-failure',
    } satisfies Partial<AccessManagementApiError>));
  });

  it('lets the API own the authentication decision when the local token is absent', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'identity.not_authenticated',
        message: 'A Bearer access token is required.',
        retryable: false,
      },
      requestId: 'request-no-session',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    const client = new FetchAccessManagementApiClient(async () => null, '/api/v1', fetcher);

    await expect(client.getMyTenantAccess('tenant-1')).rejects.toMatchObject({
      code: 'identity.not_authenticated',
      status: 401,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [, options] = fetcher.mock.calls[0]!;
    expect((options.headers as Headers).has('Authorization')).toBe(false);
  });
});
