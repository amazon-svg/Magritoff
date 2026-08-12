import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { categoryEditorialCommandSchema, categoryEditorialResultSchema } from '../../modules/diagnostics/api/contracts.ts';
import { AssistantRejectedError, type AssistantService } from '../../modules/diagnostics/application/assistant-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createAssistantRoutes(service: AssistantService): readonly ApiRoute[] {
  return [defineJsonRoute({
    method: 'POST',
    path: `${API_V1_BASE_PATH}/tenants/{tenantId}/assistant/category-editorial`,
    authentication: 'required',
    inputSchema: categoryEditorialCommandSchema,
    outputSchema: categoryEditorialResultSchema,
    async handle(context, command) {
      try {
        return { status: 200, body: await service.categoryEditorial(actor(context), tenantId(context), command) };
      } catch (error) {
        if (error instanceof AssistantRejectedError) throw new ApiHttpError({ type: 'about:blank', title: 'Accès assistant interdit', status: 403, code: `assistant.${error.code}`, detail: error.message });
        throw error;
      }
    },
  })];
}

function actor(context: ApiRequestContext): UserId {
  if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' });
  return context.actor.userId as UserId;
}
function tenantId(context: ApiRequestContext): string {
  const parsed = parseId(context.params.tenantId ?? '');
  if (!parsed.ok || parsed.value.length > 200) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' });
  return parsed.value;
}
