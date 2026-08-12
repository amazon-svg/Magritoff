import type { UserId } from '../../../kernel/ids/index.ts';
import type { RoleCatalogDefinition, RolesCatalog, RolesOverview, SaveRoleDefinitionCommand, SetRoleAssignmentResult, UserRolesDetail } from '../api/contracts.ts';
export class RoleRejectedError extends Error {
  constructor(public readonly code: 'permission_denied' | 'role_not_found' | 'member_not_found' | 'definition_conflict' | 'invalid_definition' | 'canonical_role', message: string) { super(message); this.name = 'RoleRejectedError'; }
}
export interface RolesRepository {
  userCapability(actor: UserId, tenantId: string, capability: string): Promise<boolean>;
  overview(actor: UserId, tenantId: string): Promise<RolesOverview>;
  catalog(actor: UserId, tenantId: string): Promise<RolesCatalog>;
  userDetail(actor: UserId, tenantId: string, userId: string): Promise<UserRolesDetail>;
  setAssignment(actor: UserId, tenantId: string, userId: string, roleId: string, active: boolean): Promise<SetRoleAssignmentResult>;
  createDefinition(actor: UserId, tenantId: string, command: SaveRoleDefinitionCommand): Promise<RoleCatalogDefinition>;
  updateDefinition(actor: UserId, tenantId: string, roleId: string, command: SaveRoleDefinitionCommand): Promise<RoleCatalogDefinition>;
  archiveDefinition(actor: UserId, tenantId: string, roleId: string): Promise<void>;
  reorderDefinitions(actor: UserId, tenantId: string, firstRoleId: string, secondRoleId: string): Promise<void>;
}
