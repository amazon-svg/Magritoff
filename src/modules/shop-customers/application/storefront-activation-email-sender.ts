export type StorefrontActivationEmail = Readonly<{
  to: string;
  customerName: string;
  shopName: string;
  link: string;
  expiresInSeconds: number;
}>;

export type StorefrontActivationEmailDelivery = Readonly<{
  sent: boolean;
  reason?: string;
}>;

export interface StorefrontActivationEmailSender {
  send(message: StorefrontActivationEmail): Promise<StorefrontActivationEmailDelivery>;
}
