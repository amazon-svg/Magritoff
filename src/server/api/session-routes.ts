import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  sessionBootstrapSchema,
  updateCurrentTenantSchema,
  updatePreferencesSchema,
  userPreferencesSchema,
  tenantMutationResultSchema,
  updateTenantSettingsSchema,
} from '../../modules/session/api/contracts.ts';
import {
  SessionTenantAccessDeniedError,
  type SessionService,
} from '../../modules/session/application/session-service.ts';
import { SessionTenantMutationError } from '../../modules/session/application/session-repository.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createSessionRoutes(service: SessionService): readonly ApiRoute[] {
  return [
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/session`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: sessionBootstrapSchema,
      async handle(context) {
        return { status: 200, body: await service.load(requireUserId(context)) };
      },
    }),
    defineJsonRoute({
      method: 'PATCH',
      path: `${API_V1_BASE_PATH}/session/preferences`,
      authentication: 'required',
      inputSchema: updatePreferencesSchema,
      outputSchema: userPreferencesSchema,
      async handle(context, patch) {
        return {
          status: 200,
          body: await service.updatePreferences(requireUserId(context), patch),
        };
      },
    }),
    defineJsonRoute({
      method: 'PUT',
      path: `${API_V1_BASE_PATH}/session/current-tenant`,
      authentication: 'required',
      inputSchema: updateCurrentTenantSchema,
      outputSchema: userPreferencesSchema,
      async handle(context, { tenantId }) {
        try {
          return {
            status: 200,
            body: await service.updateLastTenant(requireUserId(context), tenantId),
          };
        } catch (error) {
          if (error instanceof SessionTenantAccessDeniedError) {
            throw new ApiHttpError({
              type: 'about:blank',
              title: 'Accès tenant refusé',
              status: 403,
              code: 'session.tenant_access_denied',
            });
          }
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'PATCH',
      path: `${API_V1_BASE_PATH}/tenants/{tenantId}`,
      authentication: 'required',
      inputSchema: updateTenantSettingsSchema,
      outputSchema: tenantMutationResultSchema,
      async handle(context, patch) {
        try {
          return { status: 200, body: await service.updateTenantSettings(requireUserId(context), requireTenantId(context), patch) };
        } catch (error) {
          if (error instanceof SessionTenantMutationError) {
            const status = error.code === 'conflict' ? 409 : 403;
            throw new ApiHttpError({ type: 'about:blank', title: status === 409 ? 'Slug déjà utilisé' : 'Modification de l’espace interdite', status, code: `session.tenant_${error.code}`, detail: error.message });
          }
          throw error;
        }
      },
    }),
  ];
}

function requireUserId(context: ApiRequestContext): UserId {
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank',
      title: 'Acteur utilisateur requis',
      status: 403,
      code: 'identity.user_actor_required',
    });
  }
  const parsed = parseId<'UserId'>(context.actor.userId);
  if (!parsed.ok) throw new Error('Identifiant utilisateur invalide.');
  return parsed.value;
}

function requireTenantId(context: ApiRequestContext): string {
  const parsed = parseId(context.params.tenantId ?? '');
  if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant tenant invalide', status: 422, code: 'api.validation_failed' });
  return parsed.value;
}
