import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  sessionBootstrapSchema,
  updateCurrentTenantSchema,
  updatePreferencesSchema,
  userPreferencesSchema,
} from '../../modules/session/api/contracts.ts';
import {
  SessionTenantAccessDeniedError,
  type SessionService,
} from '../../modules/session/application/session-service.ts';
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
