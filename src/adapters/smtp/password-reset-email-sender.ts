import type { PasswordResetEmail, PasswordResetEmailSender } from '../../modules/account/application/password-reset-email-sender.ts';
import type { SmtpTransport } from './transport.ts';
import { renderPasswordResetHtml, renderPasswordResetText } from '../resend/password-reset-email-sender.ts';

export class SmtpPasswordResetEmailSender implements PasswordResetEmailSender {
  constructor(private readonly transport: SmtpTransport, private readonly from: string) {}

  send(message: PasswordResetEmail) {
    return this.transport.send({
      from: this.from,
      to: message.to,
      subject: 'Réinitialisation de votre mot de passe Magrit',
      html: renderPasswordResetHtml(message),
      text: renderPasswordResetText(message),
    });
  }
}
