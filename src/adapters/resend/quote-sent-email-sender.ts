import type {
  QuoteSentEmail,
  QuoteSentEmailDelivery,
  QuoteSentEmailSender,
} from '../../modules/commercial-quotes/application/quote-sent-notification-consumer.ts';

/**
 * Envoi Resend du courriel `quote.sent` au client (E10.10b-3).
 *
 * STRICTEMENT le patron de `ResendStorefrontActivationEmailSender` :
 * `apiKey: string | null` injecte, `fetch` injectable, jamais de `throw`,
 * retour `{ sent, reason? }`. Textes VALIDES par Arnaud (docs/api/
 * CONVENTIONS.md §8.13sexies, cadrage dev-story) — a coder tels quels, pas
 * reformules.
 */
export class ResendQuoteSentEmailSender implements QuoteSentEmailSender {
  constructor(
    private readonly apiKey: string | null,
    private readonly from: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async send(message: QuoteSentEmail): Promise<QuoteSentEmailDelivery> {
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
      return { sent: true };
    } catch (error) {
      return {
        sent: false,
        reason: `Resend indisponible: ${error instanceof Error ? error.message : 'erreur réseau'}`,
      };
    }
  }
}

function subjectFor(message: QuoteSentEmail): string {
  return message.isResend
    ? `${message.shopName} vous retransmet un devis`
    : `${message.shopName} vous a transmis un devis`;
}

function renderHtml(message: QuoteSentEmail): string {
  const name = escapeHtml(message.customerName);
  const shop = escapeHtml(message.shopName);
  const number = escapeHtml(message.quoteNumber);
  const link = escapeHtml(message.link);
  const validity = message.validUntilLabel
    ? `, valable jusqu'au <strong>${escapeHtml(message.validUntilLabel)}</strong>`
    : '';

  const intro = message.isResend
    ? `${shop} vous retransmet le devis <strong>${number}</strong>, toujours disponible dans votre espace client${validity}.`
    : `${shop} vient de vous transmettre le devis <strong>${number}</strong>${validity}. Vous pouvez le consulter, l'accepter ou le refuser directement depuis votre espace client.`;

  return `<!doctype html><html lang="fr"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px"><p>Bonjour ${name},</p><p>${intro}</p><p style="margin:28px 0"><a href="${link}" style="background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px">Voir mes devis</a></p><p style="font-size:12px;color:#777">Ou copiez ce lien : <a href="${link}">${link}</a></p></body></html>`;
}

function renderText(message: QuoteSentEmail): string {
  const validity = message.validUntilLabel ? `, valable jusqu'au ${message.validUntilLabel}` : '';
  const intro = message.isResend
    ? `${message.shopName} vous retransmet le devis ${message.quoteNumber}, toujours disponible dans votre espace client${validity}.`
    : `${message.shopName} vient de vous transmettre le devis ${message.quoteNumber}${validity}. Vous pouvez le consulter, l'accepter ou le refuser directement depuis votre espace client.`;
  return `Bonjour ${message.customerName},\n\n${intro}\n\n${message.link}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
