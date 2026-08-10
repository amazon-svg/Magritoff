import type { AppError, Result, TenantId, UserId } from '../../kernel';

export type Tenant = Readonly<{
  id: TenantId;
  name: string;
  status: 'active' | 'suspended' | 'archived';
}>;

export type TenantMembership = Readonly<{
  userId: UserId;
  tenantId: TenantId;
  status: 'invited' | 'active' | 'revoked';
}>;

export type TenantHierarchy = Readonly<{
  tenant: Tenant;
  parentId?: TenantId;
  children: readonly TenantId[];
}>;

export type TenantErrorCode =
  | 'tenant.not_found'
  | 'tenant.not_a_member'
  | 'tenant.membership_revoked'
  | 'tenant.hierarchy_invalid'
  | 'tenant.provider_unavailable';

export type TenantError = AppError & Readonly<{
  code: TenantErrorCode;
}>;

export interface TenantService {
  get(tenantId: TenantId): Promise<Result<Tenant | null, TenantError>>;
  listMemberships(userId: UserId): Promise<Result<readonly TenantMembership[], TenantError>>;
  resolveMembership(
    userId: UserId,
    tenantId: TenantId,
  ): Promise<Result<TenantMembership | null, TenantError>>;
  requireMembership(
    userId: UserId,
    tenantId: TenantId,
  ): Promise<Result<TenantMembership, TenantError>>;
  getHierarchy(tenantId: TenantId): Promise<Result<TenantHierarchy, TenantError>>;
}
