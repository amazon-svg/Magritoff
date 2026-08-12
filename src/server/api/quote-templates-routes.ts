import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { createQuoteTemplateSchema, quoteTemplateRemovedSchema, quoteTemplateSchema, quoteTemplatesOverviewSchema, quoteTemplateUpdatedSchema, setDefaultQuoteTemplateSchema, updateQuoteTemplateSchema } from '../../modules/quote-templates/api/contracts.ts';
import { QuoteTemplateRejectedError } from '../../modules/quote-templates/application/quote-templates-repository.ts';
import type { QuoteTemplatesService } from '../../modules/quote-templates/application/quote-templates-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';
export function createQuoteTemplatesRoutes(service: QuoteTemplatesService): readonly ApiRoute[] { const base = `${API_V1_BASE_PATH}/tenants/{tenantId}/quote-templates`; return [
  defineJsonRoute({ method: 'GET', path: base, authentication: 'required', inputSchema: null, outputSchema: quoteTemplatesOverviewSchema, async handle(c) { return execute(() => service.overview(actor(c), param(c, 'tenantId')), 200); } }),
  defineJsonRoute({ method: 'POST', path: base, authentication: 'required', inputSchema: createQuoteTemplateSchema, outputSchema: quoteTemplateSchema, async handle(c, input) { return execute(() => service.create(actor(c), param(c, 'tenantId'), input), 201); } }),
  defineJsonRoute({ method: 'PUT', path: `${base}/default`, authentication: 'required', inputSchema: setDefaultQuoteTemplateSchema, outputSchema: quoteTemplateUpdatedSchema, async handle(c, input) { return execute(() => service.setDefault(actor(c), param(c, 'tenantId'), input.id), 200); } }),
  defineJsonRoute({ method: 'PUT', path: `${base}/{templateId}`, authentication: 'required', inputSchema: updateQuoteTemplateSchema, outputSchema: quoteTemplateUpdatedSchema, async handle(c, input) { return execute(() => service.update(actor(c), param(c, 'tenantId'), param(c, 'templateId'), input), 200); } }),
  defineJsonRoute({ method: 'DELETE', path: `${base}/{templateId}`, authentication: 'required', inputSchema: null, outputSchema: quoteTemplateRemovedSchema, async handle(c) { return execute(() => service.remove(actor(c), param(c, 'tenantId'), param(c, 'templateId')), 200); } }),
]; }
async function execute<T>(operation: () => Promise<T>, status: number) { try { return { status, body: await operation() }; } catch (error) { if (error instanceof QuoteTemplateRejectedError) { const s = error.code === 'not_found' ? 404 : error.code === 'invalid_template' ? 422 : 403; throw new ApiHttpError({ type: 'about:blank', title: 'Opération gabarit impossible', status: s, code: `quote_templates.${error.code}`, detail: error.message }); } throw error; } }
function actor(c: ApiRequestContext): UserId { if (c.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return c.actor.userId as UserId; }
function param(c: ApiRequestContext, name: string): string { const parsed = parseId(c.params[name] ?? ''); if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
