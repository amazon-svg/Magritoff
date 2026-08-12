import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api';
import {
  sessionBootstrapSchema,
  updateCurrentTenantSchema,
  updatePreferencesSchema,
  userPreferencesSchema,
  tenantMutationResultSchema,
  updateTenantSettingsSchema,
  type SessionBootstrap,
  type SessionUserPreferences,
  type UpdatePreferences,
  type UpdateTenantSettings,
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

  updateTenantSettings(tenantId: string, patch: UpdateTenantSettings): Promise<void> {
    return this.client.request({
      method: 'PATCH', path: `${API_V1_BASE_PATH}/tenants/${tenantId}`,
      body: updateTenantSettingsSchema.parse(patch), responseSchema: tenantMutationResultSchema,
    }).then(() => undefined);
  }
}
