import { describe, expect, it, vi } from 'vitest';
import { ResendStorefrontActivationEmailSender } from '@/adapters/resend/storefront-activation-email-sender';

const message = {
  to: 'client@example.com',
  customerName: 'Client <Test>',
  shopName: 'Boutique & Test',
  link: 'http://localhost:5176/shop/test/activate?token=opaque-token',
  expiresInSeconds: 86_400,
};

describe('ResendStorefrontActivationEmailSender', () => {
  it('retourne un repli explicite sans accès réseau lorsque Resend est absent', async () => {
    const fetchMock = vi.fn();
    const sender = new ResendStorefrontActivationEmailSender(null, 'Magrit <test@example.com>', fetchMock as typeof fetch);
    await expect(sender.send(message)).resolves.toMatchObject({ sent: false, reason: expect.stringContaining('RESEND_API_KEY') });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie le lien par le port Resend et échappe le contenu HTML', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const sender = new ResendStorefrontActivationEmailSender('secret', 'Magrit <test@example.com>', fetchMock as typeof fetch);
    await expect(sender.send(message)).resolves.toEqual({ sent: true });
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(payload.to).toEqual(['client@example.com']);
    expect(payload.html).toContain(message.link);
    expect(payload.html).toContain('Client &lt;Test&gt;');
    expect(payload.html).toContain('Boutique &amp; Test');
  });
});
