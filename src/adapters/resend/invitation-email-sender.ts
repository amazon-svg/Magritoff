import type { InvitationEmail, InvitationEmailDelivery, InvitationEmailSender } from '../../modules/invitations/application/invitation-email-sender.ts';

export class ResendInvitationEmailSender implements InvitationEmailSender {
  constructor(
    private readonly apiKey: string | null,
    private readonly from: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async send(message: InvitationEmail): Promise<InvitationEmailDelivery> {
    if (!this.apiKey) return { sent: false, reason: 'RESEND_API_KEY non configurée' };
    try {
      const response = await this.fetchImplementation('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from, to: [message.to],
          subject: `Invitation à rejoindre ${message.tenantName} sur Magrit`,
          html: renderHtml(message), text: renderText(message),
        }),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 200);
        return { sent: false, reason: `Resend ${response.status}: ${detail}` };
      }
      return { sent: true };
    } catch (error) {
      return { sent: false, reason: `Resend indisponible: ${error instanceof Error ? error.message : 'erreur réseau'}` };
    }
  }
}

function renderHtml(message: InvitationEmail): string {
  const tenant = escapeHtml(message.tenantName);
  const link = escapeHtml(message.link);
  return `<!doctype html><html lang="fr"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px"><p>Bonjour,</p><p>Vous avez été invité(e) à rejoindre <strong>${tenant}</strong> sur Magrit.</p><p>Rôle : <strong>${escapeHtml(roleLabel(message.role))}</strong><br>Invitation valable jusqu’au ${escapeHtml(formatDate(message.expiresAt))}.</p><p style="margin:28px 0"><a href="${link}" style="background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px">Accepter l’invitation</a></p><p style="font-size:12px;color:#777">Ou copiez ce lien : <a href="${link}">${link}</a></p></body></html>`;
}
function renderText(message: InvitationEmail): string {
  return `Bonjour,\n\nVous avez été invité(e) à rejoindre ${message.tenantName} sur Magrit.\nRôle : ${roleLabel(message.role)}\nInvitation valable jusqu’au ${formatDate(message.expiresAt)}.\n\n${message.link}`;
}
function roleLabel(role: InvitationEmail['role']): string {
  return ({ admin: 'Administrateur', member: 'Utilisateur' } as const)[role];
}
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
