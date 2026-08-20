import type {
  StorefrontActivationEmail,
  StorefrontActivationEmailDelivery,
  StorefrontActivationEmailSender,
} from '../../modules/shop-customers/application/storefront-activation-email-sender.ts';

export class ResendStorefrontActivationEmailSender implements StorefrontActivationEmailSender {
  constructor(
    private readonly apiKey: string | null,
    private readonly from: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async send(message: StorefrontActivationEmail): Promise<StorefrontActivationEmailDelivery> {
    if (!this.apiKey) return { sent: false, reason: 'RESEND_API_KEY non configurée' };
    try {
      const response = await this.fetchImplementation('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: `Activez votre compte ${message.shopName}`,
          html: renderHtml(message),
          text: renderText(message),
        }),
      });
      if (!response.ok) {
        return { sent: false, reason: `Resend ${response.status}: ${(await response.text()).slice(0, 200)}` };
      }
      return { sent: true };
    } catch (error) {
      return { sent: false, reason: `Resend indisponible: ${error instanceof Error ? error.message : 'erreur réseau'}` };
    }
  }
}

function renderHtml(message: StorefrontActivationEmail): string {
  const name = escapeHtml(message.customerName);
  const shop = escapeHtml(message.shopName);
  const link = escapeHtml(message.link);
  return `<!doctype html><html lang="fr"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px"><p>Bonjour ${name},</p><p>Votre compte client pour la boutique <strong>${shop}</strong> est prêt.</p><p style="margin:28px 0"><a href="${link}" style="background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px">Activer mon compte</a></p><p>Ce lien est valable ${escapeHtml(durationLabel(message.expiresInSeconds))}.</p><p style="font-size:12px;color:#777">Ou copiez ce lien : <a href="${link}">${link}</a></p></body></html>`;
}

function renderText(message: StorefrontActivationEmail): string {
  return `Bonjour ${message.customerName},\n\nVotre compte client pour la boutique ${message.shopName} est prêt.\nActivez-le avec ce lien, valable ${durationLabel(message.expiresInSeconds)} :\n\n${message.link}`;
}

function durationLabel(seconds: number): string {
  if (seconds % 86_400 === 0) return `${seconds / 86_400} jour${seconds === 86_400 ? '' : 's'}`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600} heure${seconds === 3_600 ? '' : 's'}`;
  return `${Math.ceil(seconds / 60)} minutes`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
