import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NOTIFICATION_SEND_SETTINGS,
  NotificationSender,
  resolveFinalRender,
  type ClaimedNotificationMessage,
  type NotificationSendRepository,
  type NotificationSendSeal,
} from '@/modules/notifications/application/notification-sender';
import type { NotificationChannelAdapter, NotificationDelivery } from '@/modules/notifications/application/notification-channel-adapter';
import type { TenantId } from '@/kernel';

const TENANT = 'tenant-1' as TenantId;

function message(overrides: Partial<ClaimedNotificationMessage> = {}): ClaimedNotificationMessage {
  return Object.freeze({
    id: 'message-1',
    tenantId: TENANT,
    channel: 'email',
    recipient: 'client@example.test',
    subject: 'Sujet',
    body: 'Corps',
    attempts: 1,
    occurrenceCount: 1,
    deferredRender: null,
    ...overrides,
  });
}

class FakeRepository implements NotificationSendRepository {
  claimed: readonly ClaimedNotificationMessage[] = [];
  sent: Array<{ id: string; providerMessageId: string | null; seal: NotificationSendSeal | null }> = [];
  retried: Array<{ id: string; reason: string }> = [];
  failed: Array<{ id: string; reason: string; seal: NotificationSendSeal | null }> = [];

  async claim(): Promise<readonly ClaimedNotificationMessage[]> {
    return this.claimed;
  }

  async markSent(id: string, providerMessageId: string | null, seal: NotificationSendSeal | null): Promise<void> {
    this.sent.push({ id, providerMessageId, seal });
  }

  async markRetry(id: string, reason: string): Promise<void> {
    this.retried.push({ id, reason });
  }

  async markFailed(id: string, reason: string, seal: NotificationSendSeal | null): Promise<void> {
    this.failed.push({ id, reason, seal });
  }
}

function adapter(channel: 'email' | 'sms', send: (message: unknown) => Promise<NotificationDelivery>): NotificationChannelAdapter {
  return { channel, send: send as NotificationChannelAdapter['send'] };
}

describe('NotificationSender', () => {
  it('marque sent un message accepte par l adaptateur', async () => {
    const repository = new FakeRepository();
    repository.claimed = [message()];
    const emailAdapter = adapter('email', async () => ({ sent: true, providerMessageId: 'resend-1' }));
    const sender = new NotificationSender({ repository, adapters: { email: emailAdapter } });

    const report = await sender.runOnce();

    expect(report).toEqual({ claimed: 1, sent: 1, retried: 0, failed: 0 });
    expect(repository.sent).toEqual([{ id: 'message-1', providerMessageId: 'resend-1', seal: null }]);
  });

  it('un echec RETENTABLE laisse le message en pending (markRetry, pas markFailed)', async () => {
    const repository = new FakeRepository();
    repository.claimed = [message()];
    const emailAdapter = adapter('email', async () => ({ sent: false, reason: 'Resend 429: limite de debit', retryable: true }));
    const sender = new NotificationSender({ repository, adapters: { email: emailAdapter } });

    const report = await sender.runOnce();

    expect(report).toEqual({ claimed: 1, sent: 0, retried: 1, failed: 0 });
    expect(repository.retried).toEqual([{ id: 'message-1', reason: 'Resend 429: limite de debit' }]);
    expect(repository.failed).toEqual([]);
  });

  it('B2 — un echec RETENTABLE sur la DERNIERE reclamation possible (attempts = maxAttempts) marque le message FAILED, pas pending indefiniment', async () => {
    // `api_claim_notification_messages` n admet a la reclamation que
    // `attempts < p_max_attempts` (avant increment) ; la reclamation qui
    // produit ce message porte deja `attempts` a `maxAttempts` (post
    // increment, valeur retournee par la RPC — voir la migration) : c est sa
    // DERNIERE chance, la prochaine reclamation exigerait `attempts <
    // maxAttempts`, ce qui sera desormais faux. Un `markRetry` ici laisserait
    // le message `pending` A JAMAIS, invisible comme echec.
    const repository = new FakeRepository();
    repository.claimed = [message({ attempts: DEFAULT_NOTIFICATION_SEND_SETTINGS.maxAttempts })];
    const emailAdapter = adapter('email', async () => ({ sent: false, reason: 'Resend 500: erreur temporaire', retryable: true }));
    const sender = new NotificationSender({ repository, adapters: { email: emailAdapter } });

    const report = await sender.runOnce();

    expect(report).toEqual({ claimed: 1, sent: 0, retried: 0, failed: 1 });
    expect(repository.failed).toEqual([{ id: 'message-1', reason: 'Resend 500: erreur temporaire', seal: null }]);
    expect(repository.retried).toEqual([]);
  });

  it('un echec RETENTABLE AVANT la derniere reclamation reste markRetry (comportement inchange)', async () => {
    const repository = new FakeRepository();
    repository.claimed = [message({ attempts: DEFAULT_NOTIFICATION_SEND_SETTINGS.maxAttempts - 1 })];
    const emailAdapter = adapter('email', async () => ({ sent: false, reason: 'Resend 429: limite de debit', retryable: true }));
    const sender = new NotificationSender({ repository, adapters: { email: emailAdapter } });

    const report = await sender.runOnce();

    expect(report).toEqual({ claimed: 1, sent: 0, retried: 1, failed: 0 });
    expect(repository.retried).toEqual([{ id: 'message-1', reason: 'Resend 429: limite de debit' }]);
  });

  it('un echec NON retentable marque le message failed IMMEDIATEMENT', async () => {
    const repository = new FakeRepository();
    repository.claimed = [message()];
    const emailAdapter = adapter('email', async () => ({ sent: false, reason: 'Resend 422: destinataire invalide', retryable: false }));
    const sender = new NotificationSender({ repository, adapters: { email: emailAdapter } });

    const report = await sender.runOnce();

    expect(report).toEqual({ claimed: 1, sent: 0, retried: 0, failed: 1 });
    expect(repository.failed).toEqual([{ id: 'message-1', reason: 'Resend 422: destinataire invalide', seal: null }]);
  });

  it('un canal SANS adaptateur (sms avant E10.15e) echoue DEFINITIVEMENT, jamais en boucle de reprise', async () => {
    const repository = new FakeRepository();
    repository.claimed = [message({ channel: 'sms' })];
    const sender = new NotificationSender({ repository, adapters: { email: adapter('email', async () => ({ sent: true })) } });

    const report = await sender.runOnce();

    expect(report).toEqual({ claimed: 1, sent: 0, retried: 0, failed: 1 });
    expect(repository.failed[0]!.reason).toContain('notification.channel_not_implemented');
  });

  it('un adaptateur qui LEVE (defense en profondeur) est traite comme un echec RETENTABLE', async () => {
    const repository = new FakeRepository();
    repository.claimed = [message()];
    const emailAdapter = adapter('email', async () => {
      throw new Error('boom');
    });
    const onUnhandledError = vi.fn();
    const sender = new NotificationSender({ repository, adapters: { email: emailAdapter }, onUnhandledError });

    const report = await sender.runOnce();

    expect(report).toEqual({ claimed: 1, sent: 0, retried: 1, failed: 0 });
    expect(onUnhandledError).toHaveBeenCalledTimes(1);
  });

  it('traite un LOT de plusieurs messages, chacun independamment', async () => {
    const repository = new FakeRepository();
    repository.claimed = [message({ id: 'm1' }), message({ id: 'm2', channel: 'sms' }), message({ id: 'm3' })];
    const emailAdapter = adapter('email', async () => ({ sent: true }));
    const sender = new NotificationSender({ repository, adapters: { email: emailAdapter } });

    const report = await sender.runOnce();

    expect(report).toEqual({ claimed: 3, sent: 2, retried: 0, failed: 1 });
  });
});

describe('resolveFinalRender (E10.15d-2, §8.23 point 11)', () => {
  it('deferredRender null -> subject/body INCHANGES, aucun sceau (chemin E10.15c/d-1)', () => {
    const rendered = resolveFinalRender(message({ subject: 'Sujet', body: 'Corps final', occurrenceCount: 1 }));

    expect(rendered).toEqual({ subject: 'Sujet', body: 'Corps final', seal: null });
  });

  it('deferredRender non nul -> CONCATENE les segments avec occurrenceCount, produit un sceau', () => {
    const rendered = resolveFinalRender(
      message({
        subject: null,
        body: 'Vous avez déposé {{files.count}} fichier(s).',
        occurrenceCount: 3,
        deferredRender: {
          subject: null,
          body: [
            { kind: 'literal', text: 'Vous avez déposé ' },
            { kind: 'tag', id: 'files.count' },
            { kind: 'literal', text: ' fichier(s).' },
          ],
        },
      }),
    );

    expect(rendered).toEqual({
      subject: null,
      body: 'Vous avez déposé 3 fichier(s).',
      seal: { subject: null, body: 'Vous avez déposé 3 fichier(s).' },
    });
  });

  it('sujet AUSSI segmente -> reconstitue independamment du corps', () => {
    const rendered = resolveFinalRender(
      message({
        subject: '{{files.count}} fichier(s) reçus',
        body: 'Corps {{files.count}}',
        occurrenceCount: 5,
        deferredRender: {
          subject: [
            { kind: 'tag', id: 'files.count' },
            { kind: 'literal', text: ' fichier(s) reçus' },
          ],
          body: [{ kind: 'literal', text: 'Corps ' }, { kind: 'tag', id: 'files.count' }],
        },
      }),
    );

    expect(rendered.subject).toBe('5 fichier(s) reçus');
    expect(rendered.body).toBe('Corps 5');
    expect(rendered.seal).toEqual({ subject: '5 fichier(s) reçus', body: 'Corps 5' });
  });

  it('une occurrence CLIENT contenant litteralement {{files.count}} (segment litteral) N EST JAMAIS resolue — jamais de second balayage (point 11.1)', () => {
    const rendered = resolveFinalRender(
      message({
        subject: null,
        body: 'Client : SARL {{files.count}} Frères a déposé {{files.count}} fichier(s).',
        occurrenceCount: 2,
        deferredRender: {
          subject: null,
          body: [
            // "SARL {{files.count}} Frères" est un segment LITTERAL (donnee
            // client) — jamais resolu, contrairement au deuxieme
            // `{{files.count}}`, qui EST un segment `tag`.
            { kind: 'literal', text: 'Client : SARL {{files.count}} Frères a déposé ' },
            { kind: 'tag', id: 'files.count' },
            { kind: 'literal', text: ' fichier(s).' },
          ],
        },
      }),
    );

    expect(rendered.body).toBe('Client : SARL {{files.count}} Frères a déposé 2 fichier(s).');
  });
});

describe('NotificationSender — rendu differe, sceau applique au verdict TERMINAL (E10.15d-2)', () => {
  const DEFERRED_MESSAGE = message({
    subject: null,
    body: 'Vous avez déposé {{files.count}} fichier(s).',
    occurrenceCount: 4,
    deferredRender: {
      subject: null,
      body: [
        { kind: 'literal', text: 'Vous avez déposé ' },
        { kind: 'tag', id: 'files.count' },
        { kind: 'literal', text: ' fichier(s).' },
      ],
    },
  });

  it('sent -> le canal recoit le texte FINAL, markSent est appele avec le SCEAU (subject/body finaux)', async () => {
    const repository = new FakeRepository();
    repository.claimed = [DEFERRED_MESSAGE];
    let receivedBody: string | null = null;
    const emailAdapter = adapter('email', async (msg) => {
      receivedBody = (msg as { body: string }).body;
      return { sent: true, providerMessageId: 'resend-1' };
    });
    const sender = new NotificationSender({ repository, adapters: { email: emailAdapter } });

    await sender.runOnce();

    expect(receivedBody).toBe('Vous avez déposé 4 fichier(s).');
    expect(repository.sent).toEqual([
      { id: 'message-1', providerMessageId: 'resend-1', seal: { subject: null, body: 'Vous avez déposé 4 fichier(s).' } },
    ]);
  });

  it('echec DEFINITIF -> markFailed est appele AVEC le sceau (verdict terminal, meme discipline que markSent)', async () => {
    const repository = new FakeRepository();
    repository.claimed = [DEFERRED_MESSAGE];
    const emailAdapter = adapter('email', async () => ({ sent: false, reason: 'Resend 422: destinataire invalide', retryable: false }));
    const sender = new NotificationSender({ repository, adapters: { email: emailAdapter } });

    await sender.runOnce();

    expect(repository.failed).toEqual([
      {
        id: 'message-1',
        reason: 'Resend 422: destinataire invalide',
        seal: { subject: null, body: 'Vous avez déposé 4 fichier(s).' },
      },
    ]);
  });

  it('echec RETENTABLE -> markRetry SEUL (AUCUN sceau, le texte provisoire et les segments restent en place)', async () => {
    const repository = new FakeRepository();
    repository.claimed = [DEFERRED_MESSAGE];
    const emailAdapter = adapter('email', async () => ({ sent: false, reason: 'Resend 429: limite de debit', retryable: true }));
    const sender = new NotificationSender({ repository, adapters: { email: emailAdapter } });

    await sender.runOnce();

    expect(repository.retried).toEqual([{ id: 'message-1', reason: 'Resend 429: limite de debit' }]);
    expect(repository.sent).toEqual([]);
    expect(repository.failed).toEqual([]);
  });
});
