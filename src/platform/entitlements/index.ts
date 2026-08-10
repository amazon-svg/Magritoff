import type { AppError, Result, TenantId } from '../../kernel';

export type EntitlementErrorCode =
  | 'entitlement.feature_unavailable'
  | 'entitlement.quota_exceeded'
  | 'entitlement.invalid_amount'
  | 'entitlement.provider_unavailable';

export type EntitlementError = AppError & Readonly<{
  code: EntitlementErrorCode;
}>;

export interface EntitlementService {
  hasFeature(tenantId: TenantId, feature: string): Promise<Result<boolean, EntitlementError>>;
  requireFeature(tenantId: TenantId, feature: string): Promise<Result<void, EntitlementError>>;
  getLimit(tenantId: TenantId, quota: string): Promise<Result<number | null, EntitlementError>>;
  consume(
    tenantId: TenantId,
    quota: string,
    amount: number,
  ): Promise<Result<void, EntitlementError>>;
}
