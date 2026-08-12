import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { createEditableQuoteSchema, createQuoteDraftSchema, duplicateQuoteSchema, quoteDraftCreatedSchema, quoteRemovedSchema, quoteScopeSchema, quotesListSchema, quoteUpdatedSchema, quoteWithLinesSchema, saveQuoteSchema, setQuoteStatusSchema } from '../../modules/quotes/api/contracts.ts';
import { QuoteRejectedError } from '../../modules/quotes/application/quotes-repository.ts';
import type { QuotesService } from '../../modules/quotes/application/quotes-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createQuotesRoutes(service: QuotesService): readonly ApiRoute[] {
  const base = `${API_V1_BASE_PATH}/tenants/{tenantId}/quotes`;
  return [
    defineJsonRoute({ method: 'GET', path: base, authentication: 'required', inputSchema: null, outputSchema: quotesListSchema, async handle(context) { const scope = quoteScopeSchema.catch('mine').parse(new URL(context.request.url).searchParams.get('scope')); return execute(() => service.list(actor(context), param(context, 'tenantId'), scope), 200); } }),
    defineJsonRoute({ method: 'GET', path: `${base}/{quoteId}`, authentication: 'required', inputSchema: null, outputSchema: quoteWithLinesSchema, async handle(context) { return execute(() => service.get(actor(context), param(context, 'tenantId'), param(context, 'quoteId')), 200); } }),
    defineJsonRoute({ method: 'POST', path: base, authentication: 'required', inputSchema: createEditableQuoteSchema, outputSchema: quoteDraftCreatedSchema, async handle(context, command) { return execute(() => service.create(actor(context), param(context, 'tenantId'), command), 201); } }),
    defineJsonRoute({ method: 'POST', path: `${base}/drafts`, authentication: 'required', inputSchema: createQuoteDraftSchema, outputSchema: quoteDraftCreatedSchema, async handle(context, command) { return execute(() => service.createDraft(actor(context), param(context, 'tenantId'), command), 201); } }),
    defineJsonRoute({ method: 'PUT', path: `${base}/{quoteId}`, authentication: 'required', inputSchema: saveQuoteSchema, outputSchema: quoteUpdatedSchema, async handle(context, command) { return execute(() => service.save(actor(context), param(context, 'tenantId'), param(context, 'quoteId'), command), 200); } }),
    defineJsonRoute({ method: 'PATCH', path: `${base}/{quoteId}`, authentication: 'required', inputSchema: setQuoteStatusSchema, outputSchema: quoteUpdatedSchema, async handle(context, command) { return execute(() => service.setStatus(actor(context), param(context, 'tenantId'), param(context, 'quoteId'), command.status), 200); } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/{quoteId}`, authentication: 'required', inputSchema: null, outputSchema: quoteRemovedSchema, async handle(context) { return execute(() => service.remove(actor(context), param(context, 'tenantId'), param(context, 'quoteId')), 200); } }),
    defineJsonRoute({ method: 'POST', path: `${base}/{quoteId}/duplicate`, authentication: 'required', inputSchema: duplicateQuoteSchema, outputSchema: quoteDraftCreatedSchema, async handle(context, command) { return execute(() => service.duplicate(actor(context), param(context, 'tenantId'), param(context, 'quoteId'), command.reference), 201); } }),
  ];
}

async function execute<T>(operation: () => Promise<T>, status: number): Promise<{ status: number; body: T }> {
  try { return { status, body: await operation() }; }
  catch (error) {
    if (error instanceof QuoteRejectedError) {
      const responseStatus = error.code === 'not_found' ? 404 : error.code === 'invalid_quote' ? 422 : 403;
      throw new ApiHttpError({ type: 'about:blank', title: error.code === 'not_found' ? 'Devis introuvable' : error.code === 'invalid_quote' ? 'Devis invalide' : 'Accès devis interdit', status: responseStatus, code: `quotes.${error.code}`, detail: error.message });
    }
    throw error;
  }
}
function actor(context: ApiRequestContext): UserId { if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return context.actor.userId as UserId; }
function param(context: ApiRequestContext, name: string): string { const parsed = parseId(context.params[name] ?? ''); if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
