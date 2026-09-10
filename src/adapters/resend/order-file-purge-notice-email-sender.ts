import type {
  PurgeNoticeEmail,
  PurgeNoticeEmailDelivery,
  PurgeNoticeEmailSender,
} from '../../modules/order-files/application/purge-notice-email-sender.ts';

/**
 * Envoi Resend des rappels de purge des fichiers de commande (E10.22a,
 * docs/api/CONVENTIONS.md §8.22 §4).
 *
 * Textes valides par Arnaud le 2026-09-10.
 *
 * ── `providerMessageId` -- EXIGE par l arbitrage Arnaud du 2026-09-10 ─────
 * `POST /emails` ne rend RIEN d autre qu un `id` (`SendEmailResponse`,
 * verifie le 2026-09-10 sur `https://resend.com/openapi.json`, §0 du
 * contrat). Ce fichier le remonte donc explicitement -- c est lui, pas un
 * booleen `sent`, que le consommateur consigne contre `notice_id`.
 *
 * STRICTEMENT le patron de `ResendQuoteSentEmailSender` sinon : `apiKey:
 * string | null` injecte, `fetch` injectable, JAMAIS de `throw`.
 *
 * ── Reserve de fond, corrigee en qa-review round 1 ─────────────────────────
 * Le texte du palier `first` (J+10) disait a tort « Sauf action de votre
 * part, ils seront supprimes automatiquement… », laissant croire qu un
 * geste peut EMPECHER la suppression. La reserve (a) d Arnaud, FERMEE le
 * 2026-09-10 (contrat §8.22 §10) : aucune exemption, aucune prorogation,
 * aucun geste « Conserver ce fichier » n existe. La SEULE action possible
 * est de TELECHARGER le fichier avant l echeance — les deux textes
 * ci-dessous le disent maintenant explicitement, jamais un recours qui
 * n existe pas.
 */
export class ResendOrderFilePurgeNoticeEmailSender implements PurgeNoticeEmailSender {
  constructor(
    private readonly apiKey: string | null,
    private readonly from: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async send(message: PurgeNoticeEmail): Promise<PurgeNoticeEmailDelivery> {
    if (!this.apiKey) return { sent: false, reason: 'RESEND_API_KEY non configurée' };
    try {
      const response = await this.fetchImplementation('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: subjectFor(message),
          html: renderHtml(message),
          text: renderText(message),
        }),
      });
      if (!response.ok) {
        return { sent: false, reason: `Resend ${response.status}: ${(await response.text()).slice(0, 200)}` };
      }
      const body = (await response.json()) as { id?: unknown };
      if (typeof body.id !== 'string' || body.id.length === 0) {
        return { sent: false, reason: 'Resend: réponse sans identifiant de message (SendEmailResponse.id absent)' };
      }
      return { sent: true, providerMessageId: body.id };
    } catch (error) {
      return {
        sent: false,
        reason: `Resend indisponible: ${error instanceof Error ? error.message : 'erreur réseau'}`,
      };
    }
  }
}

function subjectFor(message: PurgeNoticeEmail): string {
  return message.stage === 'first'
    ? `Des fichiers de commande arrivent bientôt en fin de conservation`
    : `Dernier rappel avant suppression de fichiers de commande`;
}

function fileWord(count: number): string {
  return count > 1 ? `${count} fichiers` : `${count} fichier`;
}

function orderWord(count: number): string {
  return count > 1 ? `${count} commandes` : `${count} commande`;
}

function renderHtml(message: PurgeNoticeEmail): string {
  const files = escapeHtml(fileWord(message.fileCount));
  const orders = escapeHtml(orderWord(message.orderCount));
  const date = escapeHtml(message.purgeAtLabel);
  const days = message.daysBeforePurge;

  // Reserve (a) FERMEE (2026-09-10) : AUCUNE exemption/prorogation n existe.
  // La SEULE action possible est de TELECHARGER avant l echeance — jamais
  // un recours qui n existe pas.
  const intro =
    message.stage === 'first'
      ? `${files} déposés sur ${orders} arrivent au terme de leur durée de conservation (30 jours). Aucune prorogation n'est possible : si vous en avez besoin, téléchargez-les avant le <strong>${date}</strong> (dans environ ${days} jour${days > 1 ? 's' : ''}) — passé cette date, ils seront supprimés automatiquement.`
      : `Dernier rappel : ${files} déposés sur ${orders} seront supprimés automatiquement à partir du <strong>${date}</strong>, dans environ ${days} jour${days > 1 ? 's' : ''} — si vous en avez besoin, c'est le moment de les récupérer.`;

  const links = message.orderLinks
    .map(
      (url, index) =>
        `<li><a href="${escapeHtml(url)}">Commande ${index + 1}</a></li>`,
    )
    .join('');

  return `<!doctype html><html lang="fr"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px"><p>Bonjour,</p><p>${intro}</p><ul>${links}</ul><p style="font-size:12px;color:#777">Ce message est envoyé automatiquement par Magrit.</p></body></html>`;
}

function renderText(message: PurgeNoticeEmail): string {
  const files = fileWord(message.fileCount);
  const orders = orderWord(message.orderCount);
  const days = message.daysBeforePurge;
  const intro =
    message.stage === 'first'
      ? `${files} déposés sur ${orders} arrivent au terme de leur durée de conservation (30 jours). Aucune prorogation n'est possible : si vous en avez besoin, téléchargez-les avant le ${message.purgeAtLabel} (dans environ ${days} jour${days > 1 ? 's' : ''}) — passé cette date, ils seront supprimés automatiquement.`
      : `Dernier rappel : ${files} déposés sur ${orders} seront supprimés automatiquement à partir du ${message.purgeAtLabel}, dans environ ${days} jour${days > 1 ? 's' : ''} — si vous en avez besoin, c'est le moment de les récupérer.`;
  const links = message.orderLinks.map((url, index) => `- Commande ${index + 1} : ${url}`).join('\n');
  return `Bonjour,\n\n${intro}\n\n${links}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
