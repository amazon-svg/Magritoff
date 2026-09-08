import { describe, expect, it, vi } from 'vitest';
import { ResendQuoteSentEmailSender } from '@/adapters/resend/quote-sent-email-sender';
import type { QuoteSentEmail } from '@/modules/commercial-quotes/application/quote-sent-notification-consumer';

const firstSend: QuoteSentEmail = {
  to: 'client@example.com',
  customerName: 'Jean Dupont',
  shopName: 'Atelier & Fils',
  quoteNumber: 'DEV-2026-00042',
  validUntilLabel: '12 septembre 2026',
  isResend: false,
  link: 'http://localhost:5176/shop/atelier/account/quotes',
};

const resend: QuoteSentEmail = { ...firstSend, isResend: true };

describe('ResendQuoteSentEmailSender', () => {
  it('retourne un repli explicite sans accès réseau lorsque RESEND_API_KEY est absente', async () => {
    const fetchMock = vi.fn();
    const sender = new ResendQuoteSentEmailSender(null, 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);
    await expect(sender.send(firstSend)).resolves.toMatchObject({
      sent: false,
      reason: expect.stringContaining('RESEND_API_KEY'),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rend {sent:false, reason} sans lever quand Resend répond en erreur', async () => {
    const fetchMock = vi.fn(async () => new Response('quota exceeded', { status: 429 }));
    const sender = new ResendQuoteSentEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);
    await expect(sender.send(firstSend)).resolves.toMatchObject({ sent: false, reason: expect.stringContaining('429') });
  });

  it('rend {sent:false, reason} sans lever quand fetch rejette (Resend injoignable)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    const sender = new ResendQuoteSentEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);
    await expect(sender.send(firstSend)).resolves.toMatchObject({
      sent: false,
      reason: expect.stringContaining('network down'),
    });
  });

  it('premier envoi : sujet et corps EXACTS (texte validé par Arnaud), échappe le HTML', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const sender = new ResendQuoteSentEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

    await expect(
      sender.send({ ...firstSend, customerName: 'Jean <Test>', shopName: 'Boutique & Fils' }),
    ).resolves.toEqual({ sent: true });

    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(payload.from).toBe('Magrit <devis@magritapp.com>');
    expect(payload.to).toEqual(['client@example.com']);
    expect(payload.subject).toBe('Boutique & Fils vous a transmis un devis');
    expect(payload.html).toContain('Jean &lt;Test&gt;');
    expect(payload.html).toContain('Boutique &amp; Fils');
    expect(payload.html).toContain('vient de vous transmettre le devis <strong>DEV-2026-00042</strong>');
    expect(payload.html).toContain("valable jusqu'au <strong>12 septembre 2026</strong>");
    expect(payload.html).toContain("Vous pouvez le consulter, l'accepter ou le refuser directement depuis votre espace client.");
    expect(payload.html).toContain('Voir mes devis');
    expect(payload.html).toContain(firstSend.link);
    expect(payload.text).toContain('Bonjour Jean <Test>,');
    expect(payload.text).toContain('vient de vous transmettre le devis DEV-2026-00042');
    expect(payload.text).toContain(firstSend.link);
  });

  it('renvoi : sujet et corps EXACTS distincts du premier envoi ("toujours disponible", pas "mis à jour")', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const sender = new ResendQuoteSentEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

    await expect(sender.send(resend)).resolves.toEqual({ sent: true });

    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(payload.subject).toBe('Atelier & Fils vous retransmet un devis');
    expect(payload.html).toContain('vous retransmet le devis <strong>DEV-2026-00042</strong>, toujours disponible dans votre espace client');
    expect(payload.html).toContain("valable jusqu'au <strong>12 septembre 2026</strong>");
    expect(payload.html).not.toContain('mis à jour');
    expect(payload.text).toContain('vous retransmet le devis DEV-2026-00042, toujours disponible dans votre espace client');
  });

  it("omet la mention de validité quand validUntilLabel est null (aucune date n est inventée)", async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const sender = new ResendQuoteSentEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

    await sender.send({ ...firstSend, validUntilLabel: null });

    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(payload.html).not.toContain("valable jusqu'au");
    expect(payload.text).not.toContain("valable jusqu'au");
  });
});
