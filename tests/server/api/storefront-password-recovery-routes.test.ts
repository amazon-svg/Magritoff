import { describe, expect, it, vi } from 'vitest';
import { StorefrontPasswordRecoveryService, type StorefrontPasswordRecoveryGateway } from '../../../src/modules/shop-customers';
import { createApiV1Application, createStorefrontPasswordRecoveryRoutes } from '../../../src/server/api';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-opaque';
describe('routes récupération storefront', () => {
  it('répond 202 sans exposer le jeton pour compte présent ou absent', async () => {
    for (const present of [true, false]) {
      const response = await handler(present, true)(new Request('https://api.magrit.test/api/v1/storefront/boutique/password-recovery', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://magrit.test' }, body: JSON.stringify({ email: 'client@example.com' }) }));
      expect(response.status).toBe(202);
      expect(await response.text()).toBe('{"accepted":true}');
    }
  });
  it('réinitialise ou retourne un refus neutre', async () => {
    const request = () => new Request('https://api.magrit.test/api/v1/storefront/password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: TOKEN, password: 'nouveau-secret' }) });
    expect((await handler(false, true)(request())).status).toBe(200);
    const refused = await handler(false, false)(request());
    expect(refused.status).toBe(400);
    await expect(refused.json()).resolves.toMatchObject({ code: 'storefront.password_reset_failed' });
  });
});
function handler(present: boolean, reset: boolean) {
  const gateway: StorefrontPasswordRecoveryGateway = {
    issue: vi.fn(async () => present ? { token: TOKEN, customerEmail: 'client@example.com', customerName: 'Client', shopName: 'Boutique', shopSlug: 'boutique' } : null),
    reset: vi.fn(async () => reset),
  };
  return createApiV1Application({ routes: createStorefrontPasswordRecoveryRoutes(new StorefrontPasswordRecoveryService(gateway, { send: async () => undefined })), requestIdFactory: () => 'recovery-test' });
}
