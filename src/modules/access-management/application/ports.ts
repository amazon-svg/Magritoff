import type { AppError, Result, TenantId } from '../../../kernel';
import type {
  CapabilityDescriptor,
  MemberRoleAssignments,
  ModuleRegistration,
  RoleDefinition,
  RoleId,
} from '../domain';

export type AccessManagementRepositoryError = AppError & Readonly<{
  code: 'access_management.provider_unavailable' | 'access_management.invalid_legacy_data';
}>;

export type RoleStatusFilter = 'active' | 'archived' | 'all';

export interface AccessManagementReadRepository {
  listRoles(
    tenantId: TenantId,
    status: RoleStatusFilter,
  ): Promise<Result<readonly RoleDefinition[], AccessManagementRepositoryError>>;
  getRole(
    tenantId: TenantId,
    roleId: RoleId,
  ): Promise<Result<RoleDefinition | null, AccessManagementRepositoryError>>;
  listMemberAssignments(
    tenantId: TenantId,
  ): Promise<Result<readonly MemberRoleAssignments[], AccessManagementRepositoryError>>;
}

export interface CapabilityCatalog {
  list(): readonly CapabilityDescriptor[];
}

export interface ModuleCatalog {
  list(): readonly ModuleRegistration[];
}
