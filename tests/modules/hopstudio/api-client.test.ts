import { describe, expect, it, vi } from 'vitest';
import { HopeStudioApiClient } from '@/modules/hopstudio';
import { FetchApiClient } from '@/platform/api/fetch-api-client';

describe('HopeStudioApiClient', () => {
  it('charge la configuration expurgée du tenant', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('/api/v1/tenants/tenant%2F1/integrations/hopstudio');
      return Response.json({
        enabled: true,
        hopeStudioUrl: 'https://hopstudio.test/json.wcl',
        clariprintUser: 'tenant-login',
        clariprintPasswordConfigured: true,
        clariprintUrl: null,
      });
    });
    const client = new HopeStudioApiClient(new FetchApiClient('', fetchMock as typeof fetch));

    const settings = await client.getTenantSettings('tenant/1');

    expect(settings.clariprintPasswordConfigured).toBe(true);
    expect(JSON.stringify(settings)).not.toContain('password-secret');
  });

  it('envoie le nouveau mot de passe uniquement dans la commande PUT', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(String(init?.body))).toMatchObject({
        clariprintUser: 'tenant-login',
        clariprintPassword: 'password-secret',
      });
      return Response.json({ updated: true });
    });
    const client = new HopeStudioApiClient(new FetchApiClient('', fetchMock as typeof fetch));

    await client.updateTenantSettings('tenant-1', {
      clariprintUser: 'tenant-login',
      clariprintPassword: 'password-secret',
    });
  });

  it('enveloppe le callback HLUX vers la route workflow du tenant', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('/api/v1/tenants/tenant-1/integrations/hopstudio/workflow');
      expect(JSON.parse(String(init?.body))).toMatchObject({
        hook: 'magrit.workspace.home',
        event: 'callHopesServer',
        context: { tenantId: 'tenant-1', body: 'action=loadBasket' },
      });
      return Response.json({ status: 'ok' });
    });
    const client = new HopeStudioApiClient(new FetchApiClient('', fetchMock as typeof fetch));
    await expect(client.callWorkflow('tenant-1', {
      hook: 'magrit.workspace.home',
      event: 'callHopesServer',
      provider: 'hopstudio',
      context: { tenantId: 'tenant-1', userId: 'user-1', body: 'action=loadBasket' },
    })).resolves.toEqual({ status: 'ok' });
  });
});
