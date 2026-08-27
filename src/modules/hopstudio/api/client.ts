import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import {
  hopeStudioTenantSettingsSchema,
  hopeStudioTenantSettingsUpdatedSchema,
  updateHopeStudioTenantSettingsSchema,
  type HopeStudioTenantSettings,
  type UpdateHopeStudioTenantSettings,
} from './tenant-settings.ts';
import { z } from 'zod';
import {
  hopeStudioWorkflowCommandSchema,
  type HopeStudioWorkflowCommand,
} from './contracts.ts';

export class HopeStudioApiClient {
  constructor(private readonly client: FetchApiClient) {}

  getTenantSettings(tenantId: string, signal?: AbortSignal): Promise<HopeStudioTenantSettings> {
    return this.client.request({
      path: this.path(tenantId),
      responseSchema: hopeStudioTenantSettingsSchema,
      ...(signal ? { signal } : {}),
    });
  }

  updateTenantSettings(
    tenantId: string,
    command: UpdateHopeStudioTenantSettings,
  ): Promise<void> {
    return this.client.request({
      method: 'PUT',
      path: this.path(tenantId),
      body: updateHopeStudioTenantSettingsSchema.parse(command),
      responseSchema: hopeStudioTenantSettingsUpdatedSchema,
    }).then(() => undefined);
  }

  callWorkflow(
    tenantId: string,
    command: HopeStudioWorkflowCommand,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return this.client.request({
      method: 'POST',
      path: `${this.path(tenantId)}/workflow`,
      body: hopeStudioWorkflowCommandSchema.parse(command),
      responseSchema: z.unknown(),
      ...(signal ? { signal } : {}),
    });
  }

  private path(tenantId: string) {
    return `${API_V1_BASE_PATH}/tenants/${encodeURIComponent(tenantId)}/integrations/hopstudio`;
  }
}
