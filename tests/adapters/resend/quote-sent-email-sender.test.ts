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
  document: null,
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

  // ── E10.10b-4c — corps « avec pièce jointe » (2×2, textes NON validés par Arnaud) ──
  describe('piece jointe (E10.10b-4c)', () => {
    const document = { filename: 'DEV-2026-00042.pdf', base64Content: 'JVBERi0=' };

    it('pose `attachments` au format Resend (content base64, filename, content_type) quand un document est fourni', async () => {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
      const sender = new ResendQuoteSentEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

      await sender.send({ ...firstSend, document });

      const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
      expect(payload.attachments).toEqual([
        { filename: 'DEV-2026-00042.pdf', content: 'JVBERi0=', content_type: 'application/pdf' },
      ]);
    });

    it("n envoie AUCUN champ `attachments` quand document est null (le corps existant en production ne change pas)", async () => {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
      const sender = new ResendQuoteSentEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

      await sender.send(firstSend);

      const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
      expect(payload.attachments).toBeUndefined();
    });

    it('les QUATRE combinaisons (isResend × document) produisent quatre sujets DISTINCTS', async () => {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
      const sender = new ResendQuoteSentEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

      const subjectsOf = async (message: QuoteSentEmail) => {
        await sender.send(message);
        const payload = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
        return payload.subject as string;
      };

      // SEQUENTIEL, deliberement : `fetchMock.mock.calls.at(-1)` doit
      // correspondre a CET appel precis, une execution concurrente
      // (Promise.all) ne garantit pas cet ordre.
      const subjects: string[] = [];
      subjects.push(await subjectsOf({ ...firstSend, isResend: false, document: null }));
      subjects.push(await subjectsOf({ ...firstSend, isResend: true, document: null }));
      subjects.push(await subjectsOf({ ...firstSend, isResend: false, document }));
      subjects.push(await subjectsOf({ ...firstSend, isResend: true, document }));

      expect(new Set(subjects).size).toBe(4);
    });

    it('corps « avec pièce jointe » : DISTINCT du corps sans document, dans les deux variantes premier envoi/renvoi', async () => {
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
      const sender = new ResendQuoteSentEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

      await sender.send({ ...firstSend, document });
      const withDocument = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

      await sender.send(firstSend);
      const withoutDocument = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

      expect(withDocument.html).not.toBe(withoutDocument.html);
      expect(withDocument.text).not.toBe(withoutDocument.text);
      expect(withDocument.html.toLowerCase()).toContain('pdf');

      await sender.send({ ...resend, document });
      const resendWithDocument = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
      await sender.send(resend);
      const resendWithoutDocument = JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body));

      expect(resendWithDocument.html).not.toBe(resendWithoutDocument.html);
      expect(resendWithDocument.html.toLowerCase()).toContain('pièce jointe');
    });
  });
});
