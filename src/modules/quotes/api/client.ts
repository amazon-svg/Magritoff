import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { createQuoteDraftSchema, quoteDraftCreatedSchema, type CreateQuoteDraft, type QuoteDraftCreated } from './contracts.ts';

export class QuotesApiClient {
  constructor(private readonly client: FetchApiClient) {}

  createDraft(tenantId: string, command: CreateQuoteDraft): Promise<QuoteDraftCreated> {
    return this.client.request({
      method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${tenantId}/quotes/drafts`,
      body: createQuoteDraftSchema.parse(command), responseSchema: quoteDraftCreatedSchema,
    });
  }
}
