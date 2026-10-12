import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  shopCustomerPageSchema, shopCustomerDetailSchema, shopCustomerOrdersPageSchema, updateShopCustomerCommandSchema,
  type ShopCustomerPageQuery, type UpdateShopCustomerCommand,
  createShopCustomerCommandSchema,
  issueStorefrontActivationCommandSchema,
  issueStorefrontActivationResultSchema,
  inviteShopCustomerCommandSchema,
  inviteShopCustomerResultSchema,
  ensureSelfShopCustomerResultSchema,
  createShopCustomerDelegationCommandSchema,
  selfShopCustomerDelegationResultSchema,
  shopCustomerAccountSchema,
  shopCustomerAccountsSchema,
  type CreateShopCustomerCommand,
  type ShopCustomerAccount,
  type IssueStorefrontActivationCommand,
  type IssueStorefrontActivationResult,
  type InviteShopCustomerCommand,
  type InviteShopCustomerResult,
  type EnsureSelfShopCustomerResult,
  type CreateShopCustomerDelegationCommand,
  type SelfShopCustomerDelegationResult,
} from './contracts.ts';

export class ShopCustomersApiClient {
  constructor(private readonly client: FetchApiClient) {}

  listPage(tenantId: string, shopId: string, page: ShopCustomerPageQuery = {}) {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/customers/page${pageQuery(page)}`, responseSchema: shopCustomerPageSchema });
  }
  detail(tenantId: string, shopId: string, accountId: string) {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/customers/${accountId}`, responseSchema: shopCustomerDetailSchema });
  }
  ordersPage(tenantId: string, shopId: string, accountId: string, page: ShopCustomerPageQuery = {}) {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/customers/${accountId}/orders${pageQuery(page)}`, responseSchema: shopCustomerOrdersPageSchema });
  }
  update(tenantId: string, shopId: string, accountId: string, command: UpdateShopCustomerCommand) {
    return this.client.request({ method: 'PATCH', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/customers/${accountId}`,
      body: updateShopCustomerCommandSchema.parse(command), responseSchema: shopCustomerAccountSchema });
  }

  list(tenantId: string, shopId: string): Promise<ShopCustomerAccount[]> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/customers`,
      responseSchema: shopCustomerAccountsSchema,
    });
  }

  create(
    tenantId: string,
    shopId: string,
    command: CreateShopCustomerCommand,
  ): Promise<ShopCustomerAccount> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/customers`,
      body: createShopCustomerCommandSchema.parse(command),
      responseSchema: shopCustomerAccountSchema,
    });
  }

  invite(
    tenantId: string,
    shopId: string,
    command: InviteShopCustomerCommand,
  ): Promise<InviteShopCustomerResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/customers/invitations`,
      body: inviteShopCustomerCommandSchema.parse(command),
      responseSchema: inviteShopCustomerResultSchema,
    });
  }

  issueActivation(
    tenantId: string,
    shopId: string,
    customerId: string,
    command: IssueStorefrontActivationCommand = {},
  ): Promise<IssueStorefrontActivationResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/customers/${customerId}/activation`,
      body: issueStorefrontActivationCommandSchema.parse(command),
      responseSchema: issueStorefrontActivationResultSchema,
    });
  }

  ensureSelf(tenantId: string, shopId: string): Promise<EnsureSelfShopCustomerResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/customers/self`,
      responseSchema: ensureSelfShopCustomerResultSchema,
    });
  }

  startSelfDelegation(
    tenantId: string,
    shopId: string,
    command: CreateShopCustomerDelegationCommand = {},
  ): Promise<SelfShopCustomerDelegationResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shops/${shopId}/customers/self-delegation`,
      body: createShopCustomerDelegationCommandSchema.parse(command),
      responseSchema: selfShopCustomerDelegationResultSchema,
    });
  }
}


function pageQuery(page: ShopCustomerPageQuery) {
  const query = new URLSearchParams({ 'page[size]': String(page.size ?? 20) });
  if (page.cursor) query.set('page[cursor]', page.cursor);
  return `?${query.toString()}`;
}
