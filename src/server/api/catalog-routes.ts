import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { catalogRemovalResultSchema, gammeSubscriptionsSchema, generatePimDefinitionCommandSchema, generatedPimDefinitionSchema, pimCatalogSchema, pimDefinitionSchema, pimGammeSchema, pimIngestReportSchema, pimPendingCandidatesSchema, runPimIngestCommandSchema, setGammeSubscriptionsCommandSchema, upsertPimDefinitionCommandSchema, upsertPimGammeCommandSchema } from '../../modules/catalog/api/contracts.ts';
import { CatalogRejectedError } from '../../modules/catalog/application/catalog-repository.ts';
import type { CatalogService } from '../../modules/catalog/application/catalog-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createCatalogRoutes(service: CatalogService): readonly ApiRoute[] {
  const path = `${API_V1_BASE_PATH}/tenants/{tenantId}/catalog/gamme-subscriptions`;
  const pim = `${API_V1_BASE_PATH}/catalog/pim`;
  return [
    defineJsonRoute({ method: 'GET', path, authentication: 'required', inputSchema: null, outputSchema: gammeSubscriptionsSchema,
      async handle(context) { return execute(async () => ({ status: 200, body: await service.gammeSubscriptions(actor(context), tenant(context)) })); } }),
    defineJsonRoute({ method: 'PUT', path, authentication: 'required', inputSchema: setGammeSubscriptionsCommandSchema, outputSchema: gammeSubscriptionsSchema,
      async handle(context, command) { return execute(async () => ({ status: 200, body: await service.setGammeSubscriptions(actor(context), tenant(context), command) })); } }),
    defineJsonRoute({ method: 'GET', path: pim, authentication: 'required', inputSchema: null, outputSchema: pimCatalogSchema,
      async handle(context) { return execute(async () => ({ status: 200, body: await service.pimCatalog(actor(context)) })); } }),
    defineJsonRoute({ method: 'PUT', path: `${pim}/gammes/{slug}`, authentication: 'required', inputSchema: upsertPimGammeCommandSchema, outputSchema: pimGammeSchema,
      async handle(context, command) { return execute(async () => ({ status: 200, body: await service.upsertPimGamme(actor(context), { ...command, slug: slug(context) }) })); } }),
    defineJsonRoute({ method: 'DELETE', path: `${pim}/gammes/{slug}`, authentication: 'required', inputSchema: null, outputSchema: catalogRemovalResultSchema,
      async handle(context) { return execute(async () => { await service.deletePimGamme(actor(context), slug(context)); return { status: 200, body: { removed: true as const } }; }); } }),
    defineJsonRoute({ method: 'PUT', path: `${pim}/definitions`, authentication: 'required', inputSchema: upsertPimDefinitionCommandSchema, outputSchema: pimDefinitionSchema,
      async handle(context, command) { return execute(async () => ({ status: 200, body: await service.upsertPimDefinition(actor(context), command) })); } }),
    defineJsonRoute({ method: 'DELETE', path: `${pim}/definitions/{definitionId}`, authentication: 'required', inputSchema: null, outputSchema: catalogRemovalResultSchema,
      async handle(context) { return execute(async () => { await service.deletePimDefinition(actor(context), idParam(context, 'definitionId')); return { status: 200, body: { removed: true as const } }; }); } }),
    defineJsonRoute({ method: 'GET', path: `${pim}/ingestion`, authentication: 'required', inputSchema: null, outputSchema: pimPendingCandidatesSchema,
      async handle(context) { return execute(async () => ({ status: 200, body: await service.pimPendingCandidates(actor(context)) })); } }),
    defineJsonRoute({ method: 'POST', path: `${pim}/ingestion`, authentication: 'required', inputSchema: runPimIngestCommandSchema, outputSchema: pimIngestReportSchema,
      async handle(context, command) { return execute(async () => ({ status: 200, body: await service.runPimIngest(actor(context), command) })); } }),
    defineJsonRoute({ method: 'POST', path: `${pim}/generation`, authentication: 'required', inputSchema: generatePimDefinitionCommandSchema, outputSchema: generatedPimDefinitionSchema,
      async handle(context, command) { return execute(async () => ({ status: 200, body: await service.generatePimDefinition(actor(context), command) })); } }),
  ];
}

async function execute<T>(operation: () => Promise<T>): Promise<T> { try { return await operation(); } catch (error) { if (error instanceof CatalogRejectedError) { const status = error.code === 'invalid_request' ? 422 : error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : error.code === 'upstream_error' ? 502 : 403; throw new ApiHttpError({ type: 'about:blank', title: status === 422 ? 'Catalogue invalide' : status === 404 ? 'Ressource catalogue introuvable' : status === 409 ? 'Conflit catalogue' : status === 502 ? 'Service catalogue indisponible' : 'Gestion du catalogue interdite', status, code: `catalog.${error.code}`, detail: error.message }); } throw error; } }
function actor(context: ApiRequestContext): UserId { if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return context.actor.userId as UserId; }
function tenant(context: ApiRequestContext): string { const parsed = parseId(context.params.tenantId ?? ''); if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant tenant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
function idParam(context: ApiRequestContext, name: string): string { const raw = context.params[name] ?? ''; const parsed = parseId(raw); if (!parsed.ok || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
function slug(context: ApiRequestContext): string { const value = context.params.slug?.trim() ?? ''; if (!/^[a-z0-9_-]{1,160}$/.test(value)) throw new ApiHttpError({ type: 'about:blank', title: 'Slug invalide', status: 422, code: 'api.validation_failed' }); return value; }
