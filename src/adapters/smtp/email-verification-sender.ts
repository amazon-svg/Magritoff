import type {
  EmailVerificationMessage,
  EmailVerificationSender,
} from '../../modules/account/application/email-verification-sender.ts';
import {
  renderEmailVerificationHtml,
  renderEmailVerificationText,
} from '../resend/email-verification-sender.ts';
import type { SmtpTransport } from './transport.ts';

export class SmtpEmailVerificationSender implements EmailVerificationSender {
  constructor(private readonly transport: SmtpTransport, private readonly from: string) {}

  send(message: EmailVerificationMessage) {
    return this.transport.send({
      from: this.from,
      to: message.to,
      subject: 'Confirmez votre adresse email Magrit',
      html: renderEmailVerificationHtml(message),
      text: renderEmailVerificationText(message),
    });
  }
}
