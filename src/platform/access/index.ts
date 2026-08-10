import type { ActorContext, AppError, Result, TenantId } from '../../kernel';

export type ResourceRef = Readonly<{
  type: string;
  id: string;
  tenantId: TenantId;
}>;

export type AccessDecision =
  | Readonly<{
      allowed: true;
      reason: 'role' | 'ownership' | 'tenant_admin' | 'system_policy';
    }>
  | Readonly<{
      allowed: false;
      reason:
        | 'not_authenticated'
        | 'not_a_member'
        | 'missing_capability'
        | 'wrong_tenant'
        | 'resource_scope'
        | 'provider_unavailable';
    }>;

export type AccessErrorCode =
  | 'access.not_authenticated'
  | 'access.not_a_member'
  | 'access.missing_capability'
  | 'access.wrong_tenant'
  | 'access.resource_scope'
  | 'access.provider_unavailable';

export type AccessError = AppError & Readonly<{
  code: AccessErrorCode;
}>;

export interface AccessService {
  can(actor: ActorContext, capability: string, resource?: ResourceRef): Promise<AccessDecision>;
  require(
    actor: ActorContext,
    capability: string,
    resource?: ResourceRef,
  ): Promise<Result<void, AccessError>>;
  listCapabilities(actor: ActorContext): Promise<Result<readonly string[], AccessError>>;
}
