import type {
  CapabilityDescriptor,
  MemberRoleAssignments,
  ModuleAvailability,
  MyTenantAccess,
  RoleDefinition,
} from '../domain';

export const accessManagementApi = Object.freeze({
  basePath: '/api/v1',
  tenantAccessPath: (tenantId: string) => `/api/v1/tenants/${tenantId}/access`,
});

export type AccessManagementApiErrorResponse = Readonly<{
  error: Readonly<{
    code: string;
    message: string;
    retryable: boolean;
  }>;
  requestId: string;
}>;

export interface AccessManagementApi {
  getMyTenantAccess(tenantId: string): Promise<MyTenantAccess>;
  listModules(tenantId: string): Promise<readonly ModuleAvailability[]>;
  listCapabilities(tenantId: string): Promise<readonly CapabilityDescriptor[]>;
  listRoles(tenantId: string): Promise<readonly RoleDefinition[]>;
  listMemberAssignments(
    tenantId: string,
  ): Promise<readonly MemberRoleAssignments[]>;
}
