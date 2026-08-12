import { parseId, type UserId } from '../../kernel/ids/index.ts';
import { clientGroupSchema, clientPriceRuleSchema, commercialOverviewSchema, commercialRemovedSchema, commercialUpdatedSchema, createClientGroupSchema, createPriceRuleSchema, groupMembersSchema, setRuleActiveSchema } from '../../modules/commercial/api/contracts.ts';
import type { CommercialService } from '../../modules/commercial/application/commercial-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createCommercialRoutes(service: CommercialService): readonly ApiRoute[] {
  const base = `${API_V1_BASE_PATH}/tenants/{tenantId}/commercial`;
  return [
    defineJsonRoute({ method: 'GET', path: base, authentication: 'required', inputSchema: null, outputSchema: commercialOverviewSchema, async handle(context) { return { status: 200, body: await service.overview(actor(context), param(context, 'tenantId')) }; } }),
    defineJsonRoute({ method: 'POST', path: `${base}/groups`, authentication: 'required', inputSchema: createClientGroupSchema, outputSchema: clientGroupSchema, async handle(context, command) { return { status: 201, body: await service.createGroup(actor(context), param(context, 'tenantId'), command.name) }; } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/groups/{groupId}`, authentication: 'required', inputSchema: null, outputSchema: commercialRemovedSchema, async handle(context) { return { status: 200, body: await service.removeGroup(actor(context), param(context, 'tenantId'), param(context, 'groupId')) }; } }),
    defineJsonRoute({ method: 'GET', path: `${base}/groups/{groupId}/members`, authentication: 'required', inputSchema: null, outputSchema: groupMembersSchema, async handle(context) { return { status: 200, body: await service.groupMembers(actor(context), param(context, 'tenantId'), param(context, 'groupId')) }; } }),
    defineJsonRoute({ method: 'PUT', path: `${base}/groups/{groupId}/members/{userId}`, authentication: 'required', inputSchema: null, outputSchema: commercialUpdatedSchema, async handle(context) { return { status: 200, body: await service.setGroupMember(actor(context), param(context, 'tenantId'), param(context, 'groupId'), param(context, 'userId'), true) }; } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/groups/{groupId}/members/{userId}`, authentication: 'required', inputSchema: null, outputSchema: commercialUpdatedSchema, async handle(context) { return { status: 200, body: await service.setGroupMember(actor(context), param(context, 'tenantId'), param(context, 'groupId'), param(context, 'userId'), false) }; } }),
    defineJsonRoute({ method: 'POST', path: `${base}/rules`, authentication: 'required', inputSchema: createPriceRuleSchema, outputSchema: clientPriceRuleSchema, async handle(context, command) { return { status: 201, body: await service.createRule(actor(context), param(context, 'tenantId'), command) }; } }),
    defineJsonRoute({ method: 'PATCH', path: `${base}/rules/{ruleId}`, authentication: 'required', inputSchema: setRuleActiveSchema, outputSchema: clientPriceRuleSchema, async handle(context, command) { return { status: 200, body: await service.setRuleActive(actor(context), param(context, 'tenantId'), param(context, 'ruleId'), command.active) }; } }),
    defineJsonRoute({ method: 'DELETE', path: `${base}/rules/{ruleId}`, authentication: 'required', inputSchema: null, outputSchema: commercialRemovedSchema, async handle(context) { return { status: 200, body: await service.removeRule(actor(context), param(context, 'tenantId'), param(context, 'ruleId')) }; } }),
  ];
}
function actor(context: ApiRequestContext): UserId { if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return context.actor.userId as UserId; }
function param(context: ApiRequestContext, name: string): string { const parsed = parseId(context.params[name] ?? ''); if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
