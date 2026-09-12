import type {
  NotificationChannelAdapter,
  NotificationDelivery,
  RenderedNotification,
} from '../../modules/notifications/application/notification-channel-adapter.ts';

/**
 * Envoi Resend du canal `email` du drain de notifications generique
 * (story E10.15c, contrat §8.23 §6). REUTILISE le compte Resend en
 * service, SANS le dupliquer : meme `RESEND_API_KEY`, meme
 * `MAGRIT_FROM_EMAIL`, meme `fetch` injectable, meme discipline
 * « jamais de `throw` » que les six autres adaptateurs Resend du depot.
 *
 * Le corps STOCKE (`notification_logs.body`) est du TEXTE BRUT, fige a la
 * mise en file (contrat §8.23 §5) — IDENTIQUE pour `email` et `sms`. Cet
 * adaptateur l enveloppe dans un gabarit visuel MINIMAL au moment de
 * l ENVOI, en echappant le texte substitue (`escapeHtml`, meme fonction
 * dupliquee dans chaque envoyeur Resend du depot) — JAMAIS avant, sinon la
 * version texte du courriel porterait des `&amp;` (contrat §8.23 §5).
 *
 * `retryable` (contrat §8.23 §6) : un `429`/`5xx` Resend merite d etre
 * retente (limite de debit, indisponibilite passagere) ; tout autre `4xx`
 * (400/401/403/404/422…) signale une erreur de FORME ou de DROIT qui ne se
 * resoudra pas au prochain tour — les six adaptateurs Resend anterieurs
 * n avaient pas besoin de cette distinction (un seul essai suffisait a leur
 * usage).
 *
 * `providerMessageId` — meme champ verifie que `ResendOrderFilePurgeNoticeEmailSender`
 * (`SendEmailResponse.id`, docs Resend, cf. commentaire de cet adaptateur) :
 * repris ICI SANS RE-VERIFICATION DIRECTE DE LA DOCUMENTATION OFFICIELLE
 * PAR CETTE STORY (Context7 indisponible dans cet environnement, aucun accès
 * réseau non plus) — c est un usage DEJA VALIDE dans ce depot, pas une
 * affirmation nouvelle de memoire d entrainement sur l API Resend.
 */
export class ResendNotificationEmailSender implements NotificationChannelAdapter {
  readonly channel = 'email' as const;

  constructor(
    private readonly apiKey: string | null,
    private readonly from: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async send(message: RenderedNotification): Promise<NotificationDelivery> {
    if (!this.apiKey) {
      return { sent: false, reason: 'RESEND_API_KEY non configurée', retryable: true };
    }
    try {
      const response = await this.fetchImplementation('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject ?? '(sans objet)',
          html: renderHtml(message.body),
          text: message.body,
        }),
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 200);
        const retryable = response.status === 429 || response.status >= 500;
        return { sent: false, reason: `Resend ${response.status}: ${detail}`, retryable };
      }

      const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
      if (typeof body?.id !== 'string' || body.id.length === 0) {
        // Reponse 2xx sans identifiant : forme inattendue du prestataire,
        // pas une erreur de notre cote — merite une nouvelle tentative.
        return { sent: false, reason: "Resend: reponse sans identifiant de message (SendEmailResponse.id absent)", retryable: true };
      }
      return { sent: true, providerMessageId: body.id };
    } catch (error) {
      return {
        sent: false,
        reason: `Resend indisponible: ${error instanceof Error ? error.message : 'erreur réseau'}`,
        retryable: true,
      };
    }
  }
}

function renderHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<!doctype html><html lang="fr"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">${paragraphs}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
