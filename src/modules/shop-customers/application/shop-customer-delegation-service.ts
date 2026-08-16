import {
  createShopCustomerDelegationCommandSchema,
  selfShopCustomerDelegationResultSchema,
  type CreateShopCustomerDelegationCommand,
  type SelfShopCustomerDelegationResult,
} from '../api/contracts.ts';

export type IssuedShopCustomerDelegation = Readonly<{
  opaqueToken: string;
  maxAgeSeconds: number;
  result: SelfShopCustomerDelegationResult;
}>;

export interface ShopCustomerDelegationGateway {
  startSelf(
    actorId: string,
    tenantId: string,
    shopId: string,
    reason: string | null,
    expiresInSeconds: number,
  ): Promise<IssuedShopCustomerDelegation | null>;
}

export class ShopCustomerDelegationRejectedError extends Error {
  constructor() {
    super('Délégation interdite pour cette boutique.');
    this.name = 'ShopCustomerDelegationRejectedError';
  }
}

export class ShopCustomerDelegationService {
  constructor(private readonly gateway: ShopCustomerDelegationGateway) {}

  async startSelf(
    actorId: string,
    tenantId: string,
    shopId: string,
    input: CreateShopCustomerDelegationCommand,
  ): Promise<IssuedShopCustomerDelegation> {
    const command = createShopCustomerDelegationCommandSchema.parse(input);
    const issued = await this.gateway.startSelf(
      actorId,
      tenantId,
      shopId,
      command.reason ?? null,
      1_800,
    );
    if (!issued) throw new ShopCustomerDelegationRejectedError();
    return {
      ...issued,
      result: selfShopCustomerDelegationResultSchema.parse(issued.result),
    };
  }
}
