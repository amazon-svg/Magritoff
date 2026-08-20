import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { categoryEditorialCommandSchema, categoryEditorialResultSchema } from '../../modules/diagnostics/api/contracts.ts';
import { AssistantRejectedError, type AssistantService } from '../../modules/diagnostics/application/assistant-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export type StorefrontEditorialAuthorizer = (
  request: Request,
  shopSlug: string,
) => Promise<Readonly<{ tenantId: string }> | null>;

export function createAssistantRoutes(
  service: AssistantService,
  authorizeStorefront?: StorefrontEditorialAuthorizer,
): readonly ApiRoute[] {
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
  }), defineJsonRoute({
    method: 'POST',
    path: `${API_V1_BASE_PATH}/public/shops/{shopSlug}/assistant/category-editorial`,
    authentication: 'public',
    inputSchema: categoryEditorialCommandSchema,
    outputSchema: categoryEditorialResultSchema,
    async handle(context, command) {
      const shopSlug = context.params.shopSlug ?? '';
      const storefront = authorizeStorefront
        ? await authorizeStorefront(context.request, shopSlug)
        : null;
      if (!storefront) {
        throw new ApiHttpError({
          type: 'about:blank',
          title: 'Session boutique requise',
          status: 401,
          code: 'storefront.session_required',
          detail: 'Une session valide pour cette boutique est requise.',
        });
      }
      return {
        status: 200,
        body: await service.storefrontCategoryEditorial(command),
      };
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
