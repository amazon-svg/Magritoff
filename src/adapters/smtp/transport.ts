import nodemailer, { type Transporter } from 'nodemailer';

export type SmtpConfiguration = Readonly<{
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}>;

export type SmtpMessage = Readonly<{
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}>;

export function readSmtpConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SmtpConfiguration | null {
  const host = environment['MAIL_HOST']?.trim() ?? '';
  const rawPort = environment['MAIL_PORT']?.trim() ?? '';
  if (host === '' && rawPort === '') return null;
  if (host === '' || rawPort === '') {
    throw new Error(`Configuration SMTP incomplete : ${host === '' ? 'MAIL_HOST' : 'MAIL_PORT'}`);
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('MAIL_PORT doit être un port TCP valide.');
  }
  const user = environment['MAIL_USER']?.trim() ?? '';
  const password = environment['MAIL_PASSWORD'] ?? '';
  if ((user === '') !== (password === '')) {
    throw new Error(`Configuration SMTP incomplete : ${user === '' ? 'MAIL_USER' : 'MAIL_PASSWORD'}`);
  }
  const secureValue = environment['MAIL_SECURE']?.trim().toLowerCase();
  if (secureValue !== undefined && !['true', 'false'].includes(secureValue)) {
    throw new Error('MAIL_SECURE doit valoir true ou false.');
  }
  return Object.freeze({
    host,
    port,
    secure: secureValue === 'true',
    ...(user === '' ? {} : { user, password }),
  });
}

export class SmtpTransport {
  private readonly transport: Transporter;

  constructor(configuration: SmtpConfiguration) {
    this.transport = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
      ...(configuration.user === undefined
        ? {}
        : { auth: { user: configuration.user, pass: configuration.password } }),
    });
  }

  async send(message: SmtpMessage): Promise<{ sent: boolean; reason?: string }> {
    try {
      await this.transport.sendMail(message);
      return { sent: true };
    } catch (error) {
      return {
        sent: false,
        reason: `SMTP indisponible: ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      };
    }
  }
}
