import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { changeMemberRoleCommandSchema, memberMutationResultSchema, memberRemovalResultSchema, tenantMembersSchema, updateMemberAccessCommandSchema } from '../../modules/members/api/contracts.ts';
import type { MembersService } from '../../modules/members/application/members-service.ts';
import { MemberRejectedError } from '../../modules/members/application/members-repository.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createMembersRoutes(service: MembersService): readonly ApiRoute[] {
  const base = `${API_V1_BASE_PATH}/tenants/{tenantId}/members`;
  return [
    defineJsonRoute({ method: 'GET', path: base, authentication: 'required', inputSchema: null, outputSchema: tenantMembersSchema,
      async handle(context) { return execute(async () => ({ status: 200, body: await service.list(requireActor(context), uuidParam(context, 'tenantId')) })); } }),
    defineJsonRoute({ method: 'PATCH', path: `${base}/{userId}/role`, authentication: 'required', inputSchema: changeMemberRoleCommandSchema, outputSchema: memberMutationResultSchema,
      async handle(context, command) { return execute(async () => { await service.changeRole(requireActor(context), uuidParam(context, 'tenantId'), uuidParam(context, 'userId'), command); return { status: 200, body: { updated: true as const } }; }); } }),
    defineJsonRoute({ method: 'PATCH', path: `${base}/{userId}/access`, authentication: 'required', inputSchema: updateMemberAccessCommandSchema, outputSchema: memberMutationResultSchema,
      async handle(context, command) { return execute(async () => { await service.updateAccess(requireActor(context), uuidParam(context, 'tenantId'), uuidParam(context, 'userId'), command); return { status: 200, body: { updated: true as const } }; }); } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/{userId}`, authentication: 'required', inputSchema: null, outputSchema: memberRemovalResultSchema,
      async handle(context) { return execute(async () => { await service.remove(requireActor(context), uuidParam(context, 'tenantId'), uuidParam(context, 'userId')); return { status: 200, body: { removed: true as const } }; }); } }),
  ];
}

async function execute<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) { if (error instanceof MemberRejectedError) throw toHttpError(error); throw error; }
}
function toHttpError(error: MemberRejectedError): ApiHttpError {
  const status = error.code === 'member_not_found' ? 404 : error.code === 'invalid_request' ? 422 : 403;
  return new ApiHttpError({ type: 'about:blank', title: status === 404 ? 'Membre introuvable' : status === 422 ? 'Modification invalide' : 'Modification interdite', status, code: `members.${error.code}`, detail: error.message });
}
function requireActor(context: ApiRequestContext): UserId {
  if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' });
  return context.actor.userId as UserId;
}
function uuidParam(context: ApiRequestContext, name: string): string {
  const parsed = parseId(context.params[name] ?? '');
  if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' });
  return parsed.value;
}
