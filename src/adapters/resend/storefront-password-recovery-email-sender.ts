import type { StorefrontPasswordRecoveryEmail, StorefrontPasswordRecoveryEmailSender } from '../../modules/shop-customers/application/storefront-password-recovery-email-sender.ts';

export class ResendStorefrontPasswordRecoveryEmailSender implements StorefrontPasswordRecoveryEmailSender {
  constructor(private readonly apiKey: string | null, private readonly from: string, private readonly fetchImplementation: typeof fetch = globalThis.fetch) {}
  async send(message: StorefrontPasswordRecoveryEmail): Promise<void> {
    if (!this.apiKey) return;
    try {
      await this.fetchImplementation('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from, to: [message.to], subject: `Réinitialisez votre accès ${message.shopName}`,
          html: `<p>Bonjour ${escapeHtml(message.customerName)},</p><p>Vous avez demandé un nouveau mot de passe pour <strong>${escapeHtml(message.shopName)}</strong>.</p><p><a href="${escapeHtml(message.link)}">Choisir un nouveau mot de passe</a></p><p>Ce lien est valable une heure. Ignorez ce message si vous n’êtes pas à l’origine de la demande.</p>`,
          text: `Bonjour ${message.customerName},\n\nChoisissez un nouveau mot de passe pour ${message.shopName} avec ce lien valable une heure :\n\n${message.link}\n\nIgnorez ce message si vous n’êtes pas à l’origine de la demande.`,
        }),
      });
    } catch { /* Réponse publique volontairement identique ; envoi best effort. */ }
  }
}
function escapeHtml(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
