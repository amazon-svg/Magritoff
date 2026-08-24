export type StorefrontPasswordRecoveryEmail = Readonly<{
  to: string;
  customerName: string;
  shopName: string;
  link: string;
}>;

export interface StorefrontPasswordRecoveryEmailSender {
  send(message: StorefrontPasswordRecoveryEmail): Promise<void>;
}
