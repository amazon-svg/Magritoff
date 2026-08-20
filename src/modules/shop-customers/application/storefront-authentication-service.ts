import {
  createStorefrontSessionCommandSchema,
  normalizeShopCustomerEmail,
  storefrontSessionSchema,
  storefrontShopSlugSchema,
  type CreateStorefrontSessionCommand,
  type StorefrontSession,
} from '../api/contracts.ts';

export type IssuedStorefrontSession = Readonly<{
  session: StorefrontSession;
  opaqueToken: string;
  maxAgeSeconds: number;
}>;

/** The whole authentication flow must share one infrastructure transaction. */
export interface StorefrontAuthenticationGateway {
  authenticate(
    shopSlug: string,
    normalizedEmail: string,
    password: string,
  ): Promise<IssuedStorefrontSession | null>;
}

export class StorefrontAuthenticationRejectedError extends Error {
  readonly code = 'authentication_failed';
  constructor() {
    super('Email ou mot de passe incorrect.');
    this.name = 'StorefrontAuthenticationRejectedError';
  }
}

export class StorefrontAuthenticationService {
  constructor(private readonly gateway: StorefrontAuthenticationGateway) {}

  async authenticate(
    shopSlugInput: string,
    input: CreateStorefrontSessionCommand,
  ): Promise<IssuedStorefrontSession> {
    const shopSlug = storefrontShopSlugSchema.parse(shopSlugInput);
    const command = createStorefrontSessionCommandSchema.parse(input);
    const issued = await this.gateway.authenticate(
      shopSlug,
      normalizeShopCustomerEmail(command.email),
      command.password,
    );
    if (!issued) throw new StorefrontAuthenticationRejectedError();
    assertIssuedSession(issued);
    return issued;
  }
}

function assertIssuedSession(issued: IssuedStorefrontSession): void {
  storefrontSessionSchema.parse(issued.session);
  if (issued.session.identity.kind !== 'shop_customer') {
    throw new Error('Une connexion directe ne peut pas émettre une délégation.');
  }
  if (!/^[A-Za-z0-9_-]{32,512}$/.test(issued.opaqueToken)) {
    throw new Error('Le fournisseur de session a retourné un jeton non opaque.');
  }
  if (!Number.isInteger(issued.maxAgeSeconds)
    || issued.maxAgeSeconds < 1
    || issued.maxAgeSeconds > 86_400) {
    throw new Error('Le fournisseur de session a retourné une durée invalide.');
  }
}
