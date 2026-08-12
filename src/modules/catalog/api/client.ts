import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  catalogRemovalResultSchema, gammeSubscriptionsSchema, generatePimDefinitionCommandSchema, generatedPimDefinitionSchema,
  pimCatalogSchema, pimDefinitionSchema, pimGammeSchema, pimIngestReportSchema, pimPendingCandidatesSchema,
  runPimIngestCommandSchema, setGammeSubscriptionsCommandSchema, upsertPimDefinitionCommandSchema, upsertPimGammeCommandSchema,
  type GammeSubscription, type PimCatalog, type PimDefinition, type PimGamme,
  type GeneratePimDefinitionCommand, type PimIngestReport, type SetGammeSubscriptionsCommand,
  type UpsertPimDefinitionCommand, type UpsertPimGammeCommand,
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
  pimPendingCandidates(): Promise<number> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/catalog/pim/ingestion`, responseSchema: pimPendingCandidatesSchema }).then(({ pendingCount }) => pendingCount);
  }
  runPimIngest(dryRun: boolean): Promise<PimIngestReport> {
    return this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/catalog/pim/ingestion`, body: runPimIngestCommandSchema.parse({ dryRun }), responseSchema: pimIngestReportSchema });
  }
  generatePimDefinition(command: GeneratePimDefinitionCommand): Promise<Record<string, unknown>> {
    return this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/catalog/pim/generation`, body: generatePimDefinitionCommandSchema.parse(command), responseSchema: generatedPimDefinitionSchema }).then(({ generated }) => generated);
  }
}
