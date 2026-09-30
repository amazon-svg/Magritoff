import type { InvitationEmail, InvitationEmailSender } from '../../modules/invitations/application/invitation-email-sender.ts';
import { renderInvitationHtml, renderInvitationText } from '../resend/invitation-email-sender.ts';
import type { SmtpTransport } from './transport.ts';

export class SmtpInvitationEmailSender implements InvitationEmailSender {
  constructor(private readonly transport: SmtpTransport, private readonly from: string) {}

  send(message: InvitationEmail) {
    return this.transport.send({
      from: this.from,
      to: message.to,
      subject: `Invitation à rejoindre ${message.tenantName} sur Magrit`,
      html: renderInvitationHtml(message),
      text: renderInvitationText(message),
    });
  }
}
