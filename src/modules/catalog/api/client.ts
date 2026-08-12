import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  catalogRemovalResultSchema, gammeSubscriptionsSchema, pimCatalogSchema, pimDefinitionSchema, pimGammeSchema,
  setGammeSubscriptionsCommandSchema, upsertPimDefinitionCommandSchema, upsertPimGammeCommandSchema,
  type GammeSubscription, type PimCatalog, type PimDefinition, type PimGamme,
  type SetGammeSubscriptionsCommand, type UpsertPimDefinitionCommand, type UpsertPimGammeCommand,
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

  pimCatalog(): Promise<PimCatalog> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/catalog/pim`, responseSchema: pimCatalogSchema });
  }
  upsertPimGamme(command: UpsertPimGammeCommand): Promise<PimGamme> {
    return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/catalog/pim/gammes/${encodeURIComponent(command.slug)}`, body: upsertPimGammeCommandSchema.parse(command), responseSchema: pimGammeSchema });
  }
  deletePimGamme(slug: string): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/catalog/pim/gammes/${encodeURIComponent(slug)}`, responseSchema: catalogRemovalResultSchema }).then(() => undefined);
  }
  upsertPimDefinition(command: UpsertPimDefinitionCommand): Promise<PimDefinition> {
    return this.client.request({ method: 'PUT', path: `${API_V1_BASE_PATH}/catalog/pim/definitions`, body: upsertPimDefinitionCommandSchema.parse(command), responseSchema: pimDefinitionSchema });
  }
  deletePimDefinition(id: string): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/catalog/pim/definitions/${id}`, responseSchema: catalogRemovalResultSchema }).then(() => undefined);
  }
}
