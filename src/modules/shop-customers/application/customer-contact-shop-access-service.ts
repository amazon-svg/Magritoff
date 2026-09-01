/**
 * Orchestration de l ouverture/revocation d un acces boutique depuis un
 * interlocuteur E10.4 (story E10.5).
 *
 * Reste DANS le module shop-customers : il compose `ShopCustomersService` et
 * `StorefrontActivationService`, deux services deja existants de ce module,
 * exactement comme le fait deja `ShopCustomerInvitationService`. Le module
 * Clients (E10.4) ne connait ni l un ni l autre — c est la couche composition
 * (`src/server/api/customer-shop-access-routes.ts`) qui les assemble, jamais
 * une dependance d application-a-application entre modules.
 */
import type { UserId } from '../../../kernel/ids/index.ts';
import type { IssueStorefrontActivationResult, ShopCustomerAccount } from '../api/contracts.ts';
import type { ShopCustomersService } from './shop-customers-service.ts';
import { StorefrontActivationRejectedError, type StorefrontActivationService } from './storefront-activation-service.ts';

export type CustomerContactShopAccessRejectionCode =
  | 'already_open'
  | 'email_conflict'
  | 'not_open'
  | 'activation_unavailable';

export class CustomerContactShopAccessRejectedError extends Error {
  constructor(
    public readonly code: CustomerContactShopAccessRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'CustomerContactShopAccessRejectedError';
  }
}

export type OpenCustomerContactShopAccessResult = Readonly<{
  account: ShopCustomerAccount;
  activation: IssueStorefrontActivationResult;
}>;

export class CustomerContactShopAccessService {
  constructor(
    private readonly customers: ShopCustomersService,
    private readonly activations: StorefrontActivationService,
  ) {}

  /**
   * Ouvre un acces boutique explicite (CA3). Idempotent au sens metier :
   * rejoue sur un acces deja `invited`/`active` renvoie un conflit plutot que
   * de dupliquer une invitation, mais un compte trouve par email et PAS
   * encore lie a un interlocuteur est relie plutot que duplique (meme
   * discipline de reutilisation que `ShopCustomerInvitationService`).
   */
  async open(
    actor: UserId,
    tenantId: string,
    shopId: string,
    customerContactId: string,
    contact: Readonly<{ email: string; fullName: string }>,
    baseUrl: string,
  ): Promise<OpenCustomerContactShopAccessResult> {
    const existing = await this.customers.findForContact(actor, tenantId, shopId, customerContactId);
    if (existing) {
      throw new CustomerContactShopAccessRejectedError(
        'already_open',
        'Un acces boutique est deja ouvert pour cet interlocuteur dans cette boutique.',
      );
    }

    let account = await this.customers.findByEmail(actor, tenantId, shopId, contact.email);
    if (account?.customerContactId && account.customerContactId !== customerContactId) {
      throw new CustomerContactShopAccessRejectedError(
        'email_conflict',
        'Cet email est deja utilise par le compte boutique d un autre interlocuteur dans cette boutique.',
      );
    }

    if (account && !account.customerContactId) {
      account = await this.customers.linkContact(actor, account.id, customerContactId);
    }

    if (!account) {
      account = await this.customers.create(actor, tenantId, shopId, {
        email: contact.email,
        fullName: contact.fullName,
        initialStatus: 'invited',
        customerContactId,
      });
    }

    try {
      const activation = await this.activations.issue(actor, tenantId, shopId, account.id, {}, baseUrl);
      return { account, activation };
    } catch (error) {
      if (error instanceof StorefrontActivationRejectedError) {
        throw new CustomerContactShopAccessRejectedError(
          'activation_unavailable',
          'Le lien d activation ne peut pas etre emis pour ce compte (statut incompatible).',
        );
      }
      throw error;
    }
  }

  /** Revoque l acces (CA3) : delie l interlocuteur et suspend le compte lie. */
  async revoke(
    actor: UserId,
    tenantId: string,
    shopId: string,
    customerContactId: string,
  ): Promise<void> {
    const existing = await this.customers.findForContact(actor, tenantId, shopId, customerContactId);
    if (!existing) {
      throw new CustomerContactShopAccessRejectedError(
        'not_open',
        'Aucun acces boutique ouvert pour cet interlocuteur dans cette boutique.',
      );
    }
    await this.customers.revokeForContact(actor, tenantId, shopId, customerContactId);
  }
}
