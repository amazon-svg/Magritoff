import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  createShopCustomerCommandSchema,
  issueStorefrontActivationCommandSchema,
  issueStorefrontActivationResultSchema,
  legacyShopCustomerMigrationReportSchema,
  ensureSelfShopCustomerResultSchema,
  createShopCustomerDelegationCommandSchema,
  selfShopCustomerDelegationResultSchema,
  shopCustomerAccountSchema,
  shopCustomerAccountsSchema,
  type CreateShopCustomerCommand,
  type ShopCustomerAccount,
  type IssueStorefrontActivationCommand,
  type IssueStorefrontActivationResult,
  type LegacyShopCustomerMigrationReportRow,
  type EnsureSelfShopCustomerResult,
  type CreateShopCustomerDelegationCommand,
  type SelfShopCustomerDelegationResult,
} from './contracts.ts';

export class ShopCustomersApiClient {
  constructor(private readonly client: FetchApiClient) {}

  migrationReport(tenantId: string): Promise<LegacyShopCustomerMigrationReportRow[]> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/tenants/${tenantId}/shop-customer-migration-report`,
      responseSchema: legacyShopCustomerMigrationReportSchema,
    });
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
