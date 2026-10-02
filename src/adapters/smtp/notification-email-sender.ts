import type {
  NotificationChannelAdapter,
  NotificationDelivery,
  RenderedNotification,
} from '../../modules/notifications/application/notification-channel-adapter.ts';
import type { SmtpTransport } from './transport.ts';

export class SmtpNotificationEmailSender implements NotificationChannelAdapter {
  readonly channel = 'email' as const;

  constructor(
    private readonly transport: SmtpTransport,
    private readonly from: string,
  ) {}

  async send(message: RenderedNotification): Promise<NotificationDelivery> {
    const result = await this.transport.send({
      from: this.from,
      to: message.to,
      subject: message.subject ?? '(sans objet)',
      text: message.body,
      html: renderHtml(message.body),
    });
    return result.sent
      ? { sent: true }
      : { sent: false, reason: result.reason ?? 'SMTP indisponible', retryable: true };
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
