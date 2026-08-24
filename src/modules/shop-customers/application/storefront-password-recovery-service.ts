import {
  normalizeShopCustomerEmail,
  requestStorefrontPasswordRecoveryCommandSchema,
  resetStorefrontPasswordCommandSchema,
  storefrontShopSlugSchema,
  type RequestStorefrontPasswordRecoveryCommand,
  type ResetStorefrontPasswordCommand,
} from '../api/contracts.ts';
import type { StorefrontPasswordRecoveryEmailSender } from './storefront-password-recovery-email-sender.ts';

export type StorefrontPasswordRecoveryIssue = Readonly<{
  token: string; customerEmail: string; customerName: string; shopName: string; shopSlug: string;
}>;
export interface StorefrontPasswordRecoveryGateway {
  issue(shopSlug: string, normalizedEmail: string): Promise<StorefrontPasswordRecoveryIssue | null>;
  reset(token: string, password: string): Promise<boolean>;
}
export class StorefrontPasswordResetRejectedError extends Error {
  constructor() { super('Lien de récupération invalide ou expiré.'); this.name = 'StorefrontPasswordResetRejectedError'; }
}
export class StorefrontPasswordRecoveryService {
  constructor(private readonly gateway: StorefrontPasswordRecoveryGateway, private readonly emails: StorefrontPasswordRecoveryEmailSender) {}

  async request(shopSlugInput: string, input: RequestStorefrontPasswordRecoveryCommand, baseUrl: string): Promise<void> {
    const shopSlug = storefrontShopSlugSchema.parse(shopSlugInput);
    const command = requestStorefrontPasswordRecoveryCommandSchema.parse(input);
    const issued = await this.gateway.issue(shopSlug, normalizeShopCustomerEmail(command.email));
    if (!issued) return;
    const link = `${baseUrl.replace(/\/+$/, '')}/shop/${encodeURIComponent(issued.shopSlug)}/reset-password?token=${encodeURIComponent(issued.token)}`;
    await this.emails.send({ to: issued.customerEmail, customerName: issued.customerName, shopName: issued.shopName, link });
  }

  async reset(input: ResetStorefrontPasswordCommand): Promise<void> {
    const command = resetStorefrontPasswordCommandSchema.parse(input);
    if (!await this.gateway.reset(command.token, command.password)) throw new StorefrontPasswordResetRejectedError();
  }
}
