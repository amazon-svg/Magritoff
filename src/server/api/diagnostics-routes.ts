import { aiProviderDiagnosticSchema } from '../../modules/diagnostics/api/contracts.ts';
import type { DiagnosticsService } from '../../modules/diagnostics/application/diagnostics-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { defineJsonRoute, type ApiRoute } from './routes.ts';

export function createDiagnosticsRoutes(service: DiagnosticsService): readonly ApiRoute[] {
  return [defineJsonRoute({
    method: 'GET',
    path: `${API_V1_BASE_PATH}/diagnostics/ai`,
    authentication: 'required',
    inputSchema: null,
    outputSchema: aiProviderDiagnosticSchema,
    async handle() { return { status: 200, body: await service.aiProvider() }; },
  })];
}
