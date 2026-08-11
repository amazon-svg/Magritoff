import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  createInvitationCommandSchema,
  createInvitationResultSchema,
  invitationOptionsSchema,
  pendingInvitationsSchema,
  resendInvitationCommandSchema,
  resendInvitationResultSchema,
  revokeInvitationResultSchema,
} from '../../modules/invitations/api/contracts.ts';
import type { InvitationsService } from '../../modules/invitations/application/invitations-service.ts';
import { InvitationRejectedError } from '../../modules/invitations/application/invitations-repository.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createInvitationsRoutes(service: InvitationsService): readonly ApiRoute[] {
  return [
    defineJsonRoute({
      method: 'GET', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/invitation-options`,
      authentication: 'required', inputSchema: null, outputSchema: invitationOptionsSchema,
      async handle(context) {
        try {
          return { status: 200, body: await service.options(requireUserId(context), requireUuidParam(context, 'tenantId')) };
        } catch (error) {
          if (error instanceof InvitationRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'GET', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/invitations`,
      authentication: 'required', inputSchema: null, outputSchema: pendingInvitationsSchema,
      async handle(context) {
        try {
          return { status: 200, body: await service.pending(requireUserId(context), requireUuidParam(context, 'tenantId')) };
        } catch (error) {
          if (error instanceof InvitationRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'POST',
      path: `${API_V1_BASE_PATH}/invitations`,
      authentication: 'required',
      inputSchema: createInvitationCommandSchema,
      outputSchema: createInvitationResultSchema,
      async handle(context, command) {
        try {
          return {
            status: 201,
            body: await service.create(requireUserId(context), command),
          };
        } catch (error) {
          if (error instanceof InvitationRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'POST', path: `${API_V1_BASE_PATH}/invitations/{invitationId}/resend`,
      authentication: 'required', inputSchema: resendInvitationCommandSchema, outputSchema: resendInvitationResultSchema,
      async handle(context, command) {
        try {
          return { status: 200, body: await service.resend(requireUserId(context), requireUuidParam(context, 'invitationId'), command.baseUrl) };
        } catch (error) {
          if (error instanceof InvitationRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
    defineJsonRoute({
      method: 'DELETE', path: `${API_V1_BASE_PATH}/invitations/{invitationId}`,
      authentication: 'required', inputSchema: null, outputSchema: revokeInvitationResultSchema,
      async handle(context) {
        try {
          await service.revoke(requireUserId(context), requireUuidParam(context, 'invitationId'));
          return { status: 200, body: { revoked: true as const } };
        } catch (error) {
          if (error instanceof InvitationRejectedError) throw toHttpError(error);
          throw error;
        }
      },
    }),
  ];
}

function toHttpError(error: InvitationRejectedError): ApiHttpError {
  const status = error.code === 'authentication_required' ? 401
    : error.code === 'permission_denied' || error.code === 'role_mismatch_tenant' ? 403
      : error.code === 'duplicate_pending' ? 409
        : error.code === 'invalid_request' ? 422 : 502;
  return new ApiHttpError({
    type: 'about:blank',
    title: status === 401 ? 'Session expirée'
      : status === 403 ? 'Invitation interdite'
        : status === 409 ? 'Invitation déjà active'
          : status === 422 ? 'Invitation invalide' : 'Envoi de l’invitation impossible',
    status,
    code: `invitations.${error.code}`,
    detail: error.message,
  });
}

function requireUserId(context: ApiRequestContext): UserId {
  if (context.actor?.kind !== 'user') {
    throw new ApiHttpError({
      type: 'about:blank', title: 'Acteur utilisateur requis', status: 403,
      code: 'identity.user_actor_required',
    });
  }
  const parsed = parseId<'UserId'>(context.actor.userId);
  if (!parsed.ok) throw new Error('Identifiant utilisateur invalide.');
  return parsed.value;
}

function requireUuidParam(context: ApiRequestContext, name: string): string {
  const value = context.params[name] ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' });
  }
  return value;
}
