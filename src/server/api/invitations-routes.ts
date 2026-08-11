import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  createInvitationCommandSchema,
  createInvitationResultSchema,
} from '../../modules/invitations/api/contracts.ts';
import type { InvitationsService } from '../../modules/invitations/application/invitations-service.ts';
import { InvitationRejectedError } from '../../modules/invitations/application/invitations-repository.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createInvitationsRoutes(service: InvitationsService): readonly ApiRoute[] {
  return [
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
