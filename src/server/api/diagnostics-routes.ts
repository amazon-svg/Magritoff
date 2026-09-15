import type { UserId } from '../../kernel/ids/index.ts';
import { aiProviderDiagnosticSchema, clariprintDiagnosticSchema } from '../../modules/diagnostics/api/contracts.ts';
import { DiagnosticsAccessDeniedError, type DiagnosticsService } from '../../modules/diagnostics/application/diagnostics-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

/**
 * BCP-0c (docs/api/CONVENTIONS.md §8.25, point 2.3ter) — les deux routes
 * appellent un service tiers PEUT-ETRE FACTURE (Clariprint `CheckAuth`) ou
 * CERTAINEMENT FACTURE (Anthropic). Elles sont reservees a l administrateur
 * de la plateforme : `DiagnosticsService.aiProvider()`/`clariprint()`
 * verifient `is_super_admin()` AVANT tout appel a leur passerelle, et levent
 * `DiagnosticsAccessDeniedError` sinon. `execute()` la retraduit ici en 403
 * `identity.role_required` — code deja publie (§3.5, regle 3) — sans qu
 * AUCUN appel sortant n ait eu lieu.
 */
export function createDiagnosticsRoutes(service: DiagnosticsService): readonly ApiRoute[] {
  return [defineJsonRoute({
    method: 'GET',
    path: `${API_V1_BASE_PATH}/diagnostics/ai`,
    authentication: 'required',
    inputSchema: null,
    outputSchema: aiProviderDiagnosticSchema,
    async handle(context) { return { status: 200, body: await execute(() => service.aiProvider(actor(context))) }; },
  }), defineJsonRoute({
    method: 'GET',
    path: `${API_V1_BASE_PATH}/diagnostics/clariprint`,
    authentication: 'required',
    inputSchema: null,
    outputSchema: clariprintDiagnosticSchema,
    async handle(context) { return { status: 200, body: await execute(() => service.clariprint(actor(context))) }; },
  })];
}

function actor(context: ApiRequestContext): UserId {
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank',
      title: 'Acteur utilisateur requis',
      status: 403,
      code: 'identity.user_actor_required',
    });
  }
  return context.actor.userId;
}

async function execute<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DiagnosticsAccessDeniedError) {
      throw new ApiHttpError({
        type: 'about:blank',
        title: 'Habilitation insuffisante',
        status: 403,
        code: 'identity.role_required',
        detail: 'Ce diagnostic est réservé à l’administrateur de la plateforme (is_super_admin()).',
      });
    }
    throw error;
  }
}
