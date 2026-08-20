import type { UserId } from '../../../kernel/ids/index.ts';
import {
  inviteShopCustomerCommandSchema,
  inviteShopCustomerResultSchema,
  type InviteShopCustomerCommand,
  type InviteShopCustomerResult,
} from '../api/contracts.ts';
import type { ShopCustomersService } from './shop-customers-service.ts';
import type { StorefrontActivationService } from './storefront-activation-service.ts';

export class ShopCustomerInvitationRejectedError extends Error {
  constructor(public readonly code: 'already_active' | 'suspended') {
    super(
      code === 'already_active'
        ? 'Ce client possède déjà un compte actif dans cette boutique.'
        : 'Ce compte est suspendu. Réactivez-le avant de renvoyer une invitation.',
    );
    this.name = 'ShopCustomerInvitationRejectedError';
  }
}

export class ShopCustomerInvitationService {
  constructor(
    private readonly customers: ShopCustomersService,
    private readonly activations: StorefrontActivationService,
  ) {}

  async invite(
    actor: UserId,
    tenantId: string,
    shopId: string,
    input: InviteShopCustomerCommand,
    baseUrl: string,
  ): Promise<InviteShopCustomerResult> {
    const command = inviteShopCustomerCommandSchema.parse(input);
    let customer = await this.customers.findByEmail(actor, tenantId, shopId, command.email);
    let created = false;

    if (customer?.status === 'active') {
      throw new ShopCustomerInvitationRejectedError('already_active');
    }
    if (customer?.status === 'suspended') {
      throw new ShopCustomerInvitationRejectedError('suspended');
    }
    if (!customer) {
      customer = await this.customers.create(actor, tenantId, shopId, {
        email: command.email,
        initialStatus: 'invited',
      });
      created = true;
    }

    const activation = await this.activations.issue(
      actor,
      tenantId,
      shopId,
      customer.id,
      {},
      baseUrl,
    );

    return inviteShopCustomerResultSchema.parse({
      customer: { ...customer, status: 'invited' },
      created,
      activation,
    });
  }
}
