import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { createQuoteDraftSchema, quoteDraftCreatedSchema } from '../../modules/quotes/api/contracts.ts';
import { QuoteRejectedError } from '../../modules/quotes/application/quotes-repository.ts';
import type { QuotesService } from '../../modules/quotes/application/quotes-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createQuotesRoutes(service: QuotesService): readonly ApiRoute[] {
  return [defineJsonRoute({
    method: 'POST', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/quotes/drafts`,
    authentication: 'required', inputSchema: createQuoteDraftSchema, outputSchema: quoteDraftCreatedSchema,
    async handle(context, command) {
      try { return { status: 201, body: await service.createDraft(actor(context), param(context, 'tenantId'), command) }; }
      catch (error) {
        if (error instanceof QuoteRejectedError) throw new ApiHttpError({
          type: 'about:blank', title: error.code === 'invalid_quote' ? 'Brouillon invalide' : 'Création du devis interdite',
          status: error.code === 'invalid_quote' ? 422 : 403, code: `quotes.${error.code}`, detail: error.message,
        });
        throw error;
      }
    },
  })];
}
function actor(context: ApiRequestContext): UserId { if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return context.actor.userId as UserId; }
function param(context: ApiRequestContext, name: string): string { const parsed = parseId(context.params[name] ?? ''); if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
