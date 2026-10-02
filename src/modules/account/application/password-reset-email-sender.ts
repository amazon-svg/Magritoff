export type PasswordResetEmail = Readonly<{
  to: string;
  displayName: string;
  link: string;
}>;

export type PasswordResetEmailDelivery = Readonly<{
  sent: boolean;
  reason?: string;
}>;

export interface PasswordResetEmailSender {
  send(message: PasswordResetEmail): Promise<PasswordResetEmailDelivery>;
}
