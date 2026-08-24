import { describe, expect, it, vi } from 'vitest';
import { ResendStorefrontPasswordRecoveryEmailSender } from '../../../src/adapters/resend/storefront-password-recovery-email-sender';

describe('ResendStorefrontPasswordRecoveryEmailSender', () => {
  it('reste silencieux sans clé et n appelle pas le réseau', async () => {
    const fetchMock = vi.fn();
    await new ResendStorefrontPasswordRecoveryEmailSender(null, 'Magrit <test@example.com>', fetchMock as typeof fetch).send(message());
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('envoie un lien échappé sans exposer d autre secret', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    await new ResendStorefrontPasswordRecoveryEmailSender('resend-key', 'Magrit <test@example.com>', fetchMock as typeof fetch).send(message());
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body.subject).toContain('Boutique');
    expect(body.html).toContain('reset-password?token=opaque-token');
    expect(body.html).not.toContain('<Client>');
  });
});
function message() { return { to: 'client@example.com', customerName: '<Client>', shopName: 'Boutique', link: 'https://magrit.test/shop/demo/reset-password?token=opaque-token' }; }
