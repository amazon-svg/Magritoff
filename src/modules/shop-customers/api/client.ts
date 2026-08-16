import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createShopCustomerCommandSchema,
  shopCustomerAccountSchema,
  shopCustomerAccountsSchema,
  type CreateShopCustomerCommand,
  type ShopCustomerAccount,
} from './contracts.ts';

export class ShopCustomersApiClient {
  constructor(private readonly client: FetchApiClient) {}

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
}
