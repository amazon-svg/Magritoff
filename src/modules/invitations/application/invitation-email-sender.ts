export type InvitationEmail = Readonly<{
  to: string;
  tenantName: string;
  role: 'admin' | 'member' | 'partner';
  link: string;
  expiresAt: string;
}>;

export type InvitationEmailDelivery = Readonly<{
  sent: boolean;
  reason?: string;
}>;

export interface InvitationEmailSender {
  send(message: InvitationEmail): Promise<InvitationEmailDelivery>;
}
