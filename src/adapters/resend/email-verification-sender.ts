import type {
  EmailVerificationMessage,
  EmailVerificationSender,
} from '../../modules/account/application/email-verification-sender.ts';

export class ResendEmailVerificationSender implements EmailVerificationSender {
  constructor(
    private readonly apiKey: string | null,
    private readonly from: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async send(message: EmailVerificationMessage) {
    if (!this.apiKey) return { sent: false, reason: 'RESEND_API_KEY non configurée' };
    try {
      const response = await this.fetchImplementation('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: 'Confirmez votre adresse email Magrit',
          html: renderEmailVerificationHtml(message),
          text: renderEmailVerificationText(message),
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

export function renderEmailVerificationText(message: EmailVerificationMessage): string {
  return `Bonjour ${message.displayName || ''},\n\nConfirmez votre adresse email pour activer votre compte Magrit.\n\n${message.link}\n\nSi vous n’êtes pas à l’origine de cette inscription, ignorez ce message.`;
}

export function renderEmailVerificationHtml(message: EmailVerificationMessage): string {
  const name = escapeHtml(message.displayName || '');
  const link = escapeHtml(message.link);
  return `<!doctype html><html lang="fr"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px"><p>Bonjour${name ? ` ${name}` : ''},</p><p>Confirmez votre adresse email pour activer votre compte Magrit.</p><p style="margin:28px 0"><a href="${link}" style="background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px">Confirmer mon adresse</a></p><p style="font-size:12px;color:#777">Ou copiez ce lien : <a href="${link}">${link}</a></p><p>Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message.</p></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
