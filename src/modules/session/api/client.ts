import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api';
import {
  sessionBootstrapSchema,
  updateCurrentTenantSchema,
  updatePreferencesSchema,
  userPreferencesSchema,
  type SessionBootstrap,
  type SessionUserPreferences,
  type UpdatePreferences,
} from './contracts';

export class SessionApiClient {
  constructor(private readonly client: FetchApiClient) {}

  load(signal?: AbortSignal): Promise<SessionBootstrap> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/session`,
      responseSchema: sessionBootstrapSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  updatePreferences(patch: UpdatePreferences): Promise<SessionUserPreferences> {
    return this.client.request({
      method: 'PATCH',
      path: `${API_V1_BASE_PATH}/session/preferences`,
      body: updatePreferencesSchema.parse(patch),
      responseSchema: userPreferencesSchema,
    });
  }

  updateCurrentTenant(tenantId: string): Promise<SessionUserPreferences> {
    return this.client.request({
      method: 'PUT',
      path: `${API_V1_BASE_PATH}/session/current-tenant`,
      body: updateCurrentTenantSchema.parse({ tenantId }),
      responseSchema: userPreferencesSchema,
    });
  }
}
