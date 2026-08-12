import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  gammeSubscriptionsSchema, setGammeSubscriptionsCommandSchema,
  type GammeSubscription, type SetGammeSubscriptionsCommand,
} from './contracts.ts';

export class CatalogApiClient {
  constructor(private readonly client: FetchApiClient) {}

  gammeSubscriptions(tenantId: string): Promise<GammeSubscription[]> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/tenants/${tenantId}/catalog/gamme-subscriptions`,
      responseSchema: gammeSubscriptionsSchema,
    });
  }

  setGammeSubscriptions(tenantId: string, command: SetGammeSubscriptionsCommand): Promise<GammeSubscription[]> {
    return this.client.request({
      method: 'PUT',
      path: `${API_V1_BASE_PATH}/tenants/${tenantId}/catalog/gamme-subscriptions`,
      body: setGammeSubscriptionsCommandSchema.parse(command),
      responseSchema: gammeSubscriptionsSchema,
    });
  }
}
