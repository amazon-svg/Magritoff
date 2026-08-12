import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { commercialOverviewSchema } from '../../modules/commercial/api/contracts.ts';
import type { CommercialService } from '../../modules/commercial/application/commercial-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createCommercialRoutes(service: CommercialService): readonly ApiRoute[] {
  return [defineJsonRoute({ method: 'GET', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/commercial`, authentication: 'required', inputSchema: null, outputSchema: commercialOverviewSchema, async handle(context) { return { status: 200, body: await service.overview(actor(context), param(context, 'tenantId')) }; } })];
}
function actor(context: ApiRequestContext): UserId { if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return context.actor.userId as UserId; }
function param(context: ApiRequestContext, name: string): string { const parsed = parseId(context.params[name] ?? ''); if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
