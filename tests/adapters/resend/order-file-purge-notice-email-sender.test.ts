import { describe, expect, it, vi } from 'vitest';
import { ResendOrderFilePurgeNoticeEmailSender } from '@/adapters/resend/order-file-purge-notice-email-sender';
import type { PurgeNoticeEmail } from '@/modules/order-files/application/purge-notice-email-sender';

const firstStage: PurgeNoticeEmail = {
  to: 'admin@example.com',
  stage: 'first',
  fileCount: 2,
  orderCount: 1,
  purgeAtLabel: '12 octobre 2026',
  daysBeforePurge: 20,
  orderLinks: ['https://magritapp.com/t/atelier-test/dashboard/commercial-orders/order-1'],
};

const secondStage: PurgeNoticeEmail = { ...firstStage, stage: 'second', fileCount: 1, daysBeforePurge: 15 };

describe('ResendOrderFilePurgeNoticeEmailSender', () => {
  it('retourne un repli explicite sans accès réseau lorsque RESEND_API_KEY est absente', async () => {
    const fetchMock = vi.fn();
    const sender = new ResendOrderFilePurgeNoticeEmailSender(null, 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);
    await expect(sender.send(firstStage)).resolves.toMatchObject({
      sent: false,
      reason: expect.stringContaining('RESEND_API_KEY'),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rend {sent:false, reason} sans lever quand Resend répond en erreur', async () => {
    const fetchMock = vi.fn(async () => new Response('quota exceeded', { status: 429 }));
    const sender = new ResendOrderFilePurgeNoticeEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);
    await expect(sender.send(firstStage)).resolves.toMatchObject({ sent: false, reason: expect.stringContaining('429') });
  });

  it('rend {sent:false, reason} sans lever quand fetch rejette (Resend injoignable)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    const sender = new ResendOrderFilePurgeNoticeEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);
    await expect(sender.send(firstStage)).resolves.toMatchObject({
      sent: false,
      reason: expect.stringContaining('network down'),
    });
  });

  it('rend {sent:false, reason} quand Resend repond 200 SANS identifiant de message (SendEmailResponse.id absent)', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const sender = new ResendOrderFilePurgeNoticeEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);
    await expect(sender.send(firstStage)).resolves.toMatchObject({
      sent: false,
      reason: expect.stringContaining('identifiant'),
    });
  });

  it('remonte le providerMessageId EXACT rendu par Resend (arbitrage du 2026-09-10)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'resend-msg-abc' }), { status: 200 }));
    const sender = new ResendOrderFilePurgeNoticeEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

    await expect(sender.send(firstStage)).resolves.toEqual({ sent: true, providerMessageId: 'resend-msg-abc' });
  });

  it('palier first (J+10) et palier second (J+15) : DEUX textes distincts, jamais confondus', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'resend-msg-1' }), { status: 200 }));
    const sender = new ResendOrderFilePurgeNoticeEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

    await sender.send(firstStage);
    const firstPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    await sender.send(secondStage);
    const secondPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(firstPayload.subject).not.toBe(secondPayload.subject);
    expect(firstPayload.html).not.toBe(secondPayload.html);
    expect(secondPayload.subject.toLowerCase()).toContain('dernier rappel');
  });

  it('cite le nombre de fichiers/commandes et la date de purge dans le corps', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'resend-msg-1' }), { status: 200 }));
    const sender = new ResendOrderFilePurgeNoticeEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

    await sender.send(firstStage);
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(payload.to).toEqual(['admin@example.com']);
    expect(payload.html).toContain('2 fichiers');
    expect(payload.html).toContain('12 octobre 2026');
    expect(payload.text).toContain('2 fichiers');
    expect(payload.text).toContain('12 octobre 2026');
  });

  it('singulier correct pour un seul fichier/une seule commande', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'resend-msg-1' }), { status: 200 }));
    const sender = new ResendOrderFilePurgeNoticeEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

    await sender.send({ ...firstStage, fileCount: 1, orderCount: 1 });
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(payload.html).toContain('1 fichier ');
    expect(payload.html).not.toContain('1 fichiers');
  });

  // ── qa-review round 1 : reserve de fond sur le texte (aucun recours qui n existe pas) ──
  it("le palier J+10 ne promet AUCUNE exemption ni prorogation (reserve (a) FERMEE le 2026-09-10)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'resend-msg-1' }), { status: 200 }));
    const sender = new ResendOrderFilePurgeNoticeEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

    await sender.send(firstStage);
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(payload.html).not.toContain('Sauf action de votre part');
    expect(payload.html.toLowerCase()).toContain('aucune prorogation');
    expect(payload.html.toLowerCase()).toContain('téléchargez');
    expect(payload.text).not.toContain('Sauf action de votre part');
  });

  it('le palier J+15 reste correct (déjà validé par qa-review) : "c\'est le moment de les récupérer"', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'resend-msg-1' }), { status: 200 }));
    const sender = new ResendOrderFilePurgeNoticeEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

    await sender.send(secondStage);
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(payload.html).toContain("c'est le moment de les récupérer");
  });

  // ── qa-review round 1 (B2) : liens vers les fiches commande ────────────────
  it('un lien par order_id, jusqu à 50 (§4 du contrat) — jamais un lien vers un fichier', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'resend-msg-1' }), { status: 200 }));
    const sender = new ResendOrderFilePurgeNoticeEmailSender('secret', 'Magrit <devis@magritapp.com>', fetchMock as typeof fetch);

    const message = {
      ...firstStage,
      orderLinks: [
        'https://magritapp.com/t/atelier-test/dashboard/commercial-orders/order-1',
        'https://magritapp.com/t/atelier-test/dashboard/commercial-orders/order-2',
      ],
    };
    await sender.send(message);
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(payload.html).toContain(message.orderLinks[0]);
    expect(payload.html).toContain(message.orderLinks[1]);
    expect(payload.text).toContain(message.orderLinks[0]);
    expect(payload.text).toContain(message.orderLinks[1]);
  });
});
