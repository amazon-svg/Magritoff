import { parseId, type UserId } from '../../kernel/ids/index.ts';
import {
  archiveRoleResultSchema, reorderRolesCommandSchema, reorderRolesResultSchema,
  roleCatalogDefinitionSchema, rolesCatalogSchema, rolesOverviewSchema,
  saveRoleDefinitionCommandSchema, setRoleAssignmentCommandSchema,
  setRoleAssignmentResultSchema, userRolesDetailSchema, userCapabilitySchema, userAccessProfileSchema,
} from '../../modules/roles/api/contracts.ts';
import { RoleRejectedError } from '../../modules/roles/application/roles-repository.ts';
import type { RolesService } from '../../modules/roles/application/roles-service.ts';
import { API_V1_BASE_PATH } from '../../platform/api/contracts.ts';
import { ApiHttpError } from './errors.ts';
import { defineJsonRoute, type ApiRequestContext, type ApiRoute } from './routes.ts';

export function createRolesRoutes(service: RolesService): readonly ApiRoute[] {
  return [
    defineJsonRoute({ method: 'GET', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/capabilities/{capability}`, authentication: 'required', inputSchema: null, outputSchema: userCapabilitySchema,
      async handle(context) { return execute(async () => ({ status: 200, body: await service.userCapability(actor(context), param(context, 'tenantId'), capabilityParam(context)) })); } }),
    defineJsonRoute({ method: 'GET', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/access-profile`, authentication: 'required', inputSchema: null, outputSchema: userAccessProfileSchema,
      async handle(context) { return execute(async () => ({ status: 200, body: await service.accessProfile(actor(context), param(context, 'tenantId')) })); } }),
    defineJsonRoute({ method: 'GET', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/roles-overview`, authentication: 'required', inputSchema: null, outputSchema: rolesOverviewSchema,
      async handle(context) { return execute(async () => ({ status: 200, body: await service.overview(actor(context), param(context, 'tenantId')) })); } }),
    defineJsonRoute({ method: 'GET', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/roles-catalog`, authentication: 'required', inputSchema: null, outputSchema: rolesCatalogSchema,
      async handle(context) { return execute(async () => ({ status: 200, body: await service.catalog(actor(context), param(context, 'tenantId')) })); } }),
    defineJsonRoute({ method: 'POST', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/roles`, authentication: 'required', inputSchema: saveRoleDefinitionCommandSchema, outputSchema: roleCatalogDefinitionSchema,
      async handle(context, command) { return execute(async () => ({ status: 201, body: await service.createDefinition(actor(context), param(context, 'tenantId'), command) })); } }),
    defineJsonRoute({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/roles-order`, authentication: 'required', inputSchema: reorderRolesCommandSchema, outputSchema: reorderRolesResultSchema,
      async handle(context, command) { return execute(async () => { await service.reorderDefinitions(actor(context), param(context, 'tenantId'), command.firstRoleId, command.secondRoleId); return { status: 200, body: { reordered: true as const } }; }); } }),
    defineJsonRoute({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/roles/{roleId}`, authentication: 'required', inputSchema: saveRoleDefinitionCommandSchema, outputSchema: roleCatalogDefinitionSchema,
      async handle(context, command) { return execute(async () => ({ status: 200, body: await service.updateDefinition(actor(context), param(context, 'tenantId'), param(context, 'roleId'), command) })); } }),
    defineJsonRoute({ method: 'DELETE', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/roles/{roleId}`, authentication: 'required', inputSchema: null, outputSchema: archiveRoleResultSchema,
      async handle(context) { return execute(async () => { await service.archiveDefinition(actor(context), param(context, 'tenantId'), param(context, 'roleId')); return { status: 200, body: { archived: true as const } }; }); } }),
    defineJsonRoute({ method: 'GET', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/members/{userId}/roles-detail`, authentication: 'required', inputSchema: null, outputSchema: userRolesDetailSchema,
      async handle(context) { return execute(async () => ({ status: 200, body: await service.userDetail(actor(context), param(context, 'tenantId'), param(context, 'userId')) })); } }),
    defineJsonRoute({ method: 'PUT', path: `${API_V1_BASE_PATH}/tenants/{tenantId}/members/{userId}/roles/{roleId}`, authentication: 'required', inputSchema: setRoleAssignmentCommandSchema, outputSchema: setRoleAssignmentResultSchema,
      async handle(context, command) { return execute(async () => ({ status: 200, body: await service.setAssignment(actor(context), param(context, 'tenantId'), param(context, 'userId'), param(context, 'roleId'), command.active) })); } }),
  ];
}
async function execute<T>(operation: () => Promise<T>): Promise<T> { try { return await operation(); } catch (error) { if (error instanceof RoleRejectedError) throw httpError(error); throw error; } }
function httpError(error: RoleRejectedError): ApiHttpError {
  const status = error.code === 'permission_denied' ? 403
    : error.code === 'definition_conflict' || error.code === 'canonical_role' ? 409
      : error.code === 'invalid_definition' ? 422 : 404;
  return new ApiHttpError({ type: 'about:blank', title: status === 403 ? 'Gestion des rôles interdite' : status === 409 ? 'Conflit de rôle' : status === 422 ? 'Définition de rôle invalide' : 'Ressource rôle introuvable', status, code: `roles.${error.code}`, detail: error.message });
}
function actor(context: ApiRequestContext): UserId { if (context.actor?.kind !== 'user') throw new ApiHttpError({ type: 'about:blank', title: 'Acteur utilisateur requis', status: 403, code: 'identity.user_actor_required' }); return context.actor.userId as UserId; }
function param(context: ApiRequestContext, name: string): string { const parsed = parseId(context.params[name] ?? ''); if (!parsed.ok) throw new ApiHttpError({ type: 'about:blank', title: 'Identifiant invalide', status: 422, code: 'api.validation_failed' }); return parsed.value; }
function capabilityParam(context: ApiRequestContext): string {
  const capability = context.params.capability ?? '';
  if (!/^can_[a-z0-9_]+$/.test(capability) || capability.length > 80) throw new ApiHttpError({ type: 'about:blank', title: 'Capability invalide', status: 422, code: 'api.validation_failed' });
  return capability;
}
