import type { UserId } from '../../../kernel/ids/index.ts';
import type { RoleCatalogDefinition, RolesCatalog, RolesOverview, SaveRoleDefinitionCommand, SetRoleAssignmentResult, UserRolesDetail } from '../api/contracts.ts';
import type { RolesRepository } from './roles-repository.ts';
export class RolesService {
  constructor(private readonly repository: RolesRepository) {}
  async userCapability(actor: UserId, tenantId: string, capability: string) { return { capability, granted: await this.repository.userCapability(actor, tenantId, capability) }; }
  overview(actor: UserId, tenantId: string): Promise<RolesOverview> { return this.repository.overview(actor, tenantId); }
  catalog(actor: UserId, tenantId: string): Promise<RolesCatalog> { return this.repository.catalog(actor, tenantId); }
  userDetail(actor: UserId, tenantId: string, userId: string): Promise<UserRolesDetail> { return this.repository.userDetail(actor, tenantId, userId); }
  setAssignment(actor: UserId, tenantId: string, userId: string, roleId: string, active: boolean): Promise<SetRoleAssignmentResult> { return this.repository.setAssignment(actor, tenantId, userId, roleId, active); }
  createDefinition(actor: UserId, tenantId: string, command: SaveRoleDefinitionCommand): Promise<RoleCatalogDefinition> { return this.repository.createDefinition(actor, tenantId, command); }
  updateDefinition(actor: UserId, tenantId: string, roleId: string, command: SaveRoleDefinitionCommand): Promise<RoleCatalogDefinition> { return this.repository.updateDefinition(actor, tenantId, roleId, command); }
  archiveDefinition(actor: UserId, tenantId: string, roleId: string): Promise<void> { return this.repository.archiveDefinition(actor, tenantId, roleId); }
  reorderDefinitions(actor: UserId, tenantId: string, firstRoleId: string, secondRoleId: string): Promise<void> { return this.repository.reorderDefinitions(actor, tenantId, firstRoleId, secondRoleId); }
}
