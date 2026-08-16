import type { Clock } from '../../../kernel/clock/index.ts';
import {
  createStorefrontSessionCommandSchema,
  normalizeShopCustomerEmail,
  storefrontSessionSchema,
  storefrontShopSlugSchema,
  type CreateStorefrontSessionCommand,
  type ShopCustomerAccount,
  type StorefrontSession,
} from '../api/contracts.ts';

export type StorefrontShopIdentity = Readonly<{
  id: string;
  slug: string;
  active: boolean;
}>;

export type StorefrontPasswordVerification = 'matched' | 'mismatched' | 'locked';

export type IssuedStorefrontSession = Readonly<{
  session: StorefrontSession;
  opaqueToken: string;
}>;

export interface StorefrontAuthenticationRepository {
  findActiveShopBySlug(slug: string): Promise<StorefrontShopIdentity | null>;
  findAccountByNormalizedEmail(
    shopId: string,
    normalizedEmail: string,
  ): Promise<ShopCustomerAccount | null>;
}

export interface StorefrontCredentialVerifier {
  verify(accountId: string, password: string): Promise<StorefrontPasswordVerification>;
  performDummyVerification(password: string): Promise<void>;
  recordFailedAttempt(accountId: string): Promise<void>;
  clearFailedAttempts(accountId: string): Promise<void>;
}

export interface StorefrontSessionIssuer {
  issueDirect(account: ShopCustomerAccount, expiresAt: Date): Promise<IssuedStorefrontSession>;
}

export class StorefrontAuthenticationRejectedError extends Error {
  readonly code = 'authentication_failed';

  constructor() {
    super('Email ou mot de passe incorrect.');
    this.name = 'StorefrontAuthenticationRejectedError';
  }
}

export class StorefrontAuthenticationService {
  constructor(
    private readonly repository: StorefrontAuthenticationRepository,
    private readonly credentials: StorefrontCredentialVerifier,
    private readonly sessions: StorefrontSessionIssuer,
    private readonly clock: Clock,
    private readonly sessionDurationSeconds = 8 * 60 * 60,
  ) {
    if (!Number.isInteger(sessionDurationSeconds)
      || sessionDurationSeconds < 60
      || sessionDurationSeconds > 86_400) {
      throw new TypeError('La durée de session storefront doit être comprise entre 1 min et 24 h.');
    }
  }

  async authenticate(
    shopSlugInput: string,
    input: CreateStorefrontSessionCommand,
  ): Promise<IssuedStorefrontSession> {
    const shopSlug = storefrontShopSlugSchema.parse(shopSlugInput);
    const command = createStorefrontSessionCommandSchema.parse(input);
    const shop = await this.repository.findActiveShopBySlug(shopSlug);
    if (!shop?.active) return this.rejectAfterDummyVerification(command.password);

    const account = await this.repository.findAccountByNormalizedEmail(
      shop.id,
      normalizeShopCustomerEmail(command.email),
    );
    if (!account) return this.rejectAfterDummyVerification(command.password);

    const verification = await this.credentials.verify(account.id, command.password);
    if (verification !== 'matched' || account.status !== 'active') {
      if (verification === 'mismatched') {
        await this.credentials.recordFailedAttempt(account.id);
      }
      throw new StorefrontAuthenticationRejectedError();
    }

    await this.credentials.clearFailedAttempts(account.id);
    const expiresAt = new Date(this.clock.now().getTime() + this.sessionDurationSeconds * 1_000);
    const issued = await this.sessions.issueDirect(account, expiresAt);
    assertIssuedSession(issued, account, expiresAt);
    return issued;
  }

  private async rejectAfterDummyVerification(password: string): Promise<never> {
    await this.credentials.performDummyVerification(password);
    throw new StorefrontAuthenticationRejectedError();
  }
}

function assertIssuedSession(
  issued: IssuedStorefrontSession,
  account: ShopCustomerAccount,
  expiresAt: Date,
): void {
  const session = storefrontSessionSchema.parse(issued.session);
  if (session.identity.kind !== 'shop_customer'
    || session.customer.id !== account.id
    || session.customer.shopId !== account.shopId
    || session.expiresAt !== expiresAt.toISOString()) {
    throw new Error('La session storefront émise viole les invariants du compte.');
  }
  if (!/^[A-Za-z0-9_-]{32,512}$/.test(issued.opaqueToken)) {
    throw new Error('Le fournisseur de session a retourné un jeton non opaque.');
  }
}
