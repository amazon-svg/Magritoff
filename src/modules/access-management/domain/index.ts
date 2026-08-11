import type { Id, TenantId, UserId } from '../../../kernel';

export type RoleId = Id<'RoleId'>;

export const accessManagementCapabilities = Object.freeze({
  accessRead: 'access_management.access.read',
  rolesRead: 'access_management.roles.read',
  rolesManage: 'access_management.roles.manage',
  assignmentsRead: 'access_management.assignments.read',
  assignmentsManage: 'access_management.assignments.manage',
  auditRead: 'access_management.audit.read',
  entitlementsRead: 'platform.entitlements.read',
  entitlementsManage: 'platform.entitlements.manage',
} as const);

export type AccessManagementCapability =
  (typeof accessManagementCapabilities)[keyof typeof accessManagementCapabilities];

export type CapabilityDescriptor = Readonly<{
  name: string;
  moduleKey: string;
  label: string;
  description?: string;
  assignableByTenantAdmin: boolean;
  sensitivity: 'standard' | 'sensitive' | 'platform_only';
}>;

export type RoleDefinition = Readonly<{
  id: RoleId;
  tenantId: TenantId;
  name: string;
  description?: string;
  capabilities: readonly string[];
  kind: 'system' | 'custom';
  status: 'active' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type MemberRoleAssignments = Readonly<{
  tenantId: TenantId;
  userId: UserId;
  displayName: string;
  email?: string;
  roleIds: readonly RoleId[];
  effectiveCapabilities: readonly string[];
  version: number;
  updatedAt: string;
}>;

export type ModuleAvailabilityReason =
  | 'available'
  | 'feature_disabled'
  | 'missing_capability';

export type ModuleAvailability = Readonly<{
  moduleKey: string;
  enabled: boolean;
  accessible: boolean;
  reason: ModuleAvailabilityReason;
}>;

export type ModuleRegistration = Readonly<{
  moduleKey: string;
  feature?: string;
  accessCapability: string;
  capabilities: readonly CapabilityDescriptor[];
}>;

export type MyTenantAccess = Readonly<{
  tenantId: TenantId;
  userId: UserId;
  membership: 'active';
  capabilities: readonly string[];
  modules: readonly ModuleAvailability[];
}>;

