import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { gammeSubscriptionsSchema, setGammeSubscriptionsCommandSchema } from '../../modules/catalog/api/contracts.ts';
import { CatalogRejectedError } from '../../modules/catalog/application/catalog-repository.ts';
import type { CatalogService } from '../../modules/catalog/application/catalog-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createCatalogRoutes(service: CatalogService): readonly ApiRoute[] {
  const path = `${API_V1_BASE_PATH}/tenants/{tenantId}/catalog/gamme-subscriptions`;
  return [
    defineJsonRoute({ method: 'GET', path, authentication: 'required', inputSchema: null, outputSchema: gammeSubscriptionsSchema,
      async handle(context) { return execute(async () => ({ status: 200, body: await service.gammeSubscriptions(actor(context), tenant(context)) })); } }),
    defineJsonRoute({ method: 'PUT', path, authentication: 'required', inputSchema: setGammeSubscriptionsCommandSchema, outputSchema: gammeSubscriptionsSchema,
      async handle(context, command) { return execute(async () => ({ status: 200, body: await service.setGammeSubscriptions(actor(context), tenant(context), command) })); } }),
  ];
}

async function execute<T>(operation: () => Promise<T>): Promise<T> { try { return await operation(); } catch (error) { if (error instanceof CatalogRejectedError) throw new ApiHttpError({ type: 'about:blank', title: error.code === 'invalid_request' ? 'Souscription invalide' : 'Gestion du catalogue interdite', status: error.code === 'invalid_request' ? 422 : 403, code: `catalog.${error.code}`, detail: error.message }); throw error; } }
function actor(context: ApiRequestContext): UserId { if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return context.actor.userId as UserId; }
function tenant(context: ApiRequestContext): string { const parsed = parseId(context.params.tenantId ?? ''); if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant tenant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
