import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  sessionBootstrapSchema,
  updateCurrentTenantSchema,
  updatePreferencesSchema,
  userPreferencesSchema,
  tenantMutationResultSchema,
  updateTenantSettingsSchema,
  subTenantsDashboardSchema,
  createSubTenantSchema,
  createSubTenantResultSchema,
  removeSubTenantResultSchema,
  tenantSlugResolutionSchema,
  createRootTenantSchema,
  createRootTenantResultSchema,
  acceptTenantInvitationSchema,
  acceptTenantInvitationResultSchema,
} from '../../modules/session/api/contracts.ts';
import {
  SessionTenantAccessDeniedError,
  type SessionService,
} from '../../modules/session/application/session-service.ts';
import { SessionInvitationAcceptanceError, SessionTenantMutationError } from '../../modules/session/application/session-repository.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createSessionRoutes(service: SessionService): readonly ApiRoute[] {
  return [
    defineJsonRoute({
      method: 'GET', path: `${API_V1_BASE_PATH}/tenant-slugs/{slug}`, authentication: 'required', inputSchema: null, outputSchema: tenantSlugResolutionSchema,
      async handle(context) { return { status: 200, body: await service.resolveTenantSlug(requireUserId(context), requireSlug(context)) }; },
    }),
    defineJsonRoute({
      method: 'POST', path: `${API_V1_BASE_PATH}/tenants`, authentication: 'required', inputSchema: createRootTenantSchema, outputSchema: createRootTenantResultSchema,
      async handle(context, command) {
        try {
          return { status: 201, body: await service.createRootTenant(requireUserId(context), command) };
        } catch (error) {
          throwTenantMutation(error);
        }
      },
    }),
    defineJsonRoute({
      method: 'POST', path: `${API_V1_BASE_PATH}/session/invitations/accept`, authentication: 'required', inputSchema: acceptTenantInvitationSchema, outputSchema: acceptTenantInvitationResultSchema,
      async handle(context, { token }) {
        try {
          return { status: 200, body: await service.acceptInvitation(requireUserId(context), token) };
        } catch (error) {
          if (error instanceof SessionInvitationAcceptanceError) {
            throw new ApiHttpError({
              type: 'about:blank',
              title: error.code === 'email_mismatch' ? 'Invitation destinée à un autre compte' : 'Invitation invalide',
              status: error.code === 'email_mismatch' ? 409 : 422,
              code: `session.invitation_${error.code}`,
              detail: error.message,
            });
          }
          throw error;
        }
      },
    }),
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
          throwTenantMutation(error);
        }
      },
    }),
    defineJsonRoute({
      method: 'GET',
      path: `${API_V1_BASE_PATH}/tenants/{tenantId}/subtenants`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: subTenantsDashboardSchema,
      async handle(context) {
        try {
          return { status: 200, body: await service.subTenantsDashboard(requireUserId(context), requireTenantId(context)) };
        } catch (error) {
          throwTenantMutation(error);
        }
      },
    }),
    defineJsonRoute({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/tenants/{tenantId}/subtenants`,
      authentication: 'required',
      inputSchema: createSubTenantSchema,
      outputSchema: createSubTenantResultSchema,
      async handle(context, command) {
        try {
          return { status: 201, body: await service.createSubTenant(requireUserId(context), requireTenantId(context), command) };
        } catch (error) {
          throwTenantMutation(error);
        }
      },
    }),
    defineJsonRoute({
      method: 'DELETE',
      path: `${API_V1_BASE_PATH}/tenants/{tenantId}/subtenants/{subTenantId}`,
      authentication: 'required',
      inputSchema: null,
      outputSchema: removeSubTenantResultSchema,
      async handle(context) {
        try {
          return { status: 200, body: await service.removeSubTenant(requireUserId(context), requireTenantId(context), requireSubTenantId(context)) };
        } catch (error) {
          throwTenantMutation(error);
        }
      },
    }),
  ];
}

function throwTenantMutation(error: unknown): never {
  if (!(error instanceof SessionTenantMutationError)) throw error;
  const status = error.code === 'conflict' ? 409 : error.code === 'not_found' ? 404 : 403;
  const title = error.code === 'conflict'
    ? 'Identifiant déjà utilisé'
    : error.code === 'not_found'
      ? 'Sous-espace introuvable'
      : 'Opération sur l’espace interdite';
  throw new ApiHttpError({ type: 'about:blank', title, status, code: `session.tenant_${error.code}`, detail: error.message });
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

function requireSubTenantId(context: ApiRequestContext): string {
  const parsed = parseId(context.params.subTenantId ?? '');
  if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant sous-espace invalide', status: 422, code: 'api.validation_failed' });
  return parsed.value;
}

function requireSlug(context: ApiRequestContext): string {
  const slug = context.params.slug?.trim() ?? '';
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length > 160) throw new ApiHttpError({ type: 'about:blank', title: 'Slug tenant invalide', status: 422, code: 'api.validation_failed' });
  return slug;
}
