import { API_V1_BASE_PATH, FetchApiClient } from '../../../platform/api/index.ts';
import { aiProviderDiagnosticSchema, clariprintDiagnosticSchema, type AiProviderDiagnostic, type ClariprintDiagnostic } from './contracts.ts';

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
}
