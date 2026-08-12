import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api';
import {
  sessionBootstrapSchema,
  updateCurrentTenantSchema,
  updatePreferencesSchema,
  userPreferencesSchema,
  tenantMutationResultSchema,
  updateTenantSettingsSchema,
  subTenantsDashboardSchema,
  createSubTenantSchema,
  createSubTenantResultSchema,
  removeSubTenantResultSchema,
  tenantSlugResolutionSchema,
  type SessionBootstrap,
  type SessionUserPreferences,
  type UpdatePreferences,
  type UpdateTenantSettings,
  type CreateSubTenant,
  type SubTenantsDashboard,
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

  resolveTenantSlug(slug: string): Promise<string | null> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenant-slugs/${encodeURIComponent(slug)}`, responseSchema: tenantSlugResolutionSchema }).then((result) => result.slug);
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

  subTenantsDashboard(parentTenantId: string): Promise<SubTenantsDashboard> {
    return this.client.request({ path: `${API_V1_BASE_PATH}/tenants/${parentTenantId}/subtenants`, responseSchema: subTenantsDashboardSchema });
  }

  createSubTenant(parentTenantId: string, command: CreateSubTenant): Promise<string> {
    return this.client.request({ method: 'POST', path: `${API_V1_BASE_PATH}/tenants/${parentTenantId}/subtenants`, body: createSubTenantSchema.parse(command), responseSchema: createSubTenantResultSchema }).then(({ tenantId }) => tenantId);
  }

  removeSubTenant(parentTenantId: string, subTenantId: string): Promise<void> {
    return this.client.request({ method: 'DELETE', path: `${API_V1_BASE_PATH}/tenants/${parentTenantId}/subtenants/${subTenantId}`, responseSchema: removeSubTenantResultSchema }).then(() => undefined);
  }
}
