import { describe, expect, it, vi } from 'vitest';
import { StorefrontPasswordRecoveryService, StorefrontPasswordResetRejectedError, type StorefrontPasswordRecoveryGateway } from '../../../src/modules/shop-customers';

describe('StorefrontPasswordRecoveryService', () => {
  it('normalise la demande et envoie le lien sans le retourner au client', async () => {
    const gateway = stubGateway({ token: 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-opaque', customerEmail: 'client@example.com', customerName: 'Client', shopName: 'Boutique', shopSlug: 'boutique-test' });
    const emails = { send: vi.fn(async () => undefined) };
    await new StorefrontPasswordRecoveryService(gateway, emails).request('boutique-test', { email: ' Client@Example.COM ' }, 'https://magrit.test/');
    expect(gateway.issue).toHaveBeenCalledWith('boutique-test', 'client@example.com');
    expect(emails.send).toHaveBeenCalledWith(expect.objectContaining({ link: expect.stringContaining('/shop/boutique-test/reset-password?token=') }));
  });
  it('répond de façon identique pour un compte absent', async () => {
    const emails = { send: vi.fn(async () => undefined) };
    await expect(new StorefrontPasswordRecoveryService(stubGateway(null), emails).request('boutique-test', { email: 'absent@example.com' }, 'https://magrit.test')).resolves.toBeUndefined();
    expect(emails.send).not.toHaveBeenCalled();
  });
  it('refuse un jeton expiré sans précision', async () => {
    const gateway = stubGateway(null, false);
    await expect(new StorefrontPasswordRecoveryService(gateway, { send: async () => undefined }).reset({ token: 'abcdefghijklmnopqrstuvwxyzABCDE_1234567890-opaque', password: 'nouveau-secret' })).rejects.toBeInstanceOf(StorefrontPasswordResetRejectedError);
  });
});
function stubGateway(issue: Awaited<ReturnType<StorefrontPasswordRecoveryGateway['issue']>>, reset = true): StorefrontPasswordRecoveryGateway {
  return { issue: vi.fn(async () => issue), reset: vi.fn(async () => reset) };
}
