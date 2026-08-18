import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { aiProviderDiagnosticSchema, categoryEditorialCommandSchema, categoryEditorialResultSchema, clariprintDiagnosticSchema, type AiProviderDiagnostic, type CategoryEditorialCommand, type CategoryEditorialResult, type ClariprintDiagnostic } from './contracts.ts';

export class DiagnosticsApiClient {
  constructor(private readonly client: FetchApiClient) {}

  aiProvider(signal?: AbortSignal): Promise<AiProviderDiagnostic> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/diagnostics/ai`,
      responseSchema: aiProviderDiagnosticSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  clariprint(signal?: AbortSignal): Promise<ClariprintDiagnostic> {
    return this.client.request({
      path: `${API_V1_BASE_PATH}/diagnostics/clariprint`,
      responseSchema: clariprintDiagnosticSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  categoryEditorial(tenantId: string, command: CategoryEditorialCommand, signal?: AbortSignal): Promise<CategoryEditorialResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/tenants/${encodeURIComponent(tenantId)}/assistant/category-editorial`,
      body: categoryEditorialCommandSchema.parse(command),
      responseSchema: categoryEditorialResultSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  storefrontCategoryEditorial(shopSlug: string, command: CategoryEditorialCommand, signal?: AbortSignal): Promise<CategoryEditorialResult> {
    return this.client.request({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/public/shops/${encodeURIComponent(shopSlug)}/assistant/category-editorial`,
      body: categoryEditorialCommandSchema.parse(command),
      responseSchema: categoryEditorialResultSchema,
      ...(signal === undefined ? {} : { signal }),
    });
  }
}
