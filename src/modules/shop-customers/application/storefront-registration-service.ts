import {
  createStorefrontRegistrationCommandSchema,
  normalizeShopCustomerEmail,
  storefrontSessionSchema,
  storefrontShopSlugSchema,
  type CreateStorefrontRegistrationCommand,
} from '../api/contracts.ts';
import type { IssuedStorefrontSession } from './storefront-authentication-service.ts';

export interface StorefrontRegistrationGateway {
  register(
    shopSlug: string,
    normalizedEmail: string,
    fullName: string,
    password: string,
  ): Promise<IssuedStorefrontSession | null>;
}

export class StorefrontRegistrationRejectedError extends Error {
  readonly code = 'registration_failed';
  constructor() {
    super('Création du compte impossible. Vérifiez les informations ou connectez-vous si ce compte existe déjà.');
    this.name = 'StorefrontRegistrationRejectedError';
  }
}

export class StorefrontRegistrationService {
  constructor(private readonly gateway: StorefrontRegistrationGateway) {}

  async register(
    shopSlugInput: string,
    input: CreateStorefrontRegistrationCommand,
  ): Promise<IssuedStorefrontSession> {
    const shopSlug = storefrontShopSlugSchema.parse(shopSlugInput);
    const command = createStorefrontRegistrationCommandSchema.parse(input);
    const issued = await this.gateway.register(
      shopSlug,
      normalizeShopCustomerEmail(command.email),
      command.fullName.trim(),
      command.password,
    );
    if (!issued) throw new StorefrontRegistrationRejectedError();
    assertRegistrationSession(issued);
    return issued;
  }
}

function assertRegistrationSession(issued: IssuedStorefrontSession): void {
  storefrontSessionSchema.parse(issued.session);
  if (issued.session.identity.kind !== 'shop_customer') {
    throw new Error('Une inscription ne peut pas émettre une délégation.');
  }
  if (!/^[A-Za-z0-9_-]{32,512}$/.test(issued.opaqueToken)) {
    throw new Error('Le fournisseur d’inscription a retourné un jeton non opaque.');
  }
  if (!Number.isInteger(issued.maxAgeSeconds)
    || issued.maxAgeSeconds < 1
    || issued.maxAgeSeconds > 86_400) {
    throw new Error('Le fournisseur d’inscription a retourné une durée invalide.');
  }
}
