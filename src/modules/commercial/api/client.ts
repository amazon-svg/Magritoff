import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { commercialOverviewSchema, type CommercialOverview } from './contracts.ts';

export class CommercialApiClient {
  constructor(private readonly client: FetchApiClient) {}
  overview(tenantId: string): Promise<CommercialOverview> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${tenantId}/commercial`, responseSchema: commercialOverviewSchema });
  }
}
