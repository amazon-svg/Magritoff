import { clariprintQuoteCommandSchema, clariprintQuoteResultSchema } from '../../modules/clariprint/api/contracts.ts';
import type { ClariprintService } from '../../modules/clariprint/application/clariprint-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { defineJsonRoute, type ApiRoute } from './routes.ts';

export function createClariprintRoutes(service: ClariprintService): readonly ApiRoute[] {
  return [defineJsonRoute({ method: 'POST', path: `${API_V1_BASE_PATH}/clariprint/quote`, authentication: 'public', inputSchema: clariprintQuoteCommandSchema, outputSchema: clariprintQuoteResultSchema, async handle(_context, command) { return { status: 200, body: await service.quote(command) }; } })];
}
