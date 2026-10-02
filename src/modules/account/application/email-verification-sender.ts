export type EmailVerificationMessage = Readonly<{
  to: string;
  displayName: string;
  link: string;
}>;

export type EmailVerificationDelivery = Readonly<{
  sent: boolean;
  reason?: string;
}>;

export interface EmailVerificationSender {
  send(message: EmailVerificationMessage): Promise<EmailVerificationDelivery>;
}
