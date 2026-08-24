import type { UserId } from '../../../kernel/ids/index.ts';
import type { EnsureSelfShopCustomerResult, LegacyShopCustomerMigrationReportRow, ShopCustomerAccount, ShopCustomerAccountStatus } from '../api/contracts.ts';

export type ShopCustomerRejectionCode =
  | 'permission_denied'
  | 'shop_not_found'
  | 'account_not_found'
  | 'duplicate_email'
  | 'invalid_request';

export class ShopCustomerRejectedError extends Error {
  constructor(
    public readonly code: ShopCustomerRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'ShopCustomerRejectedError';
  }
}

export type CreateShopCustomerRecord = Readonly<{
  email: string;
  normalizedEmail: string;
  fullName: string;
  status: Extract<ShopCustomerAccountStatus, 'delegated_only' | 'invited'>;
  createdByMagritUserId: UserId;
}>;

export interface ShopCustomersRepository {
  migrationReport(actor: UserId, tenantId: string): Promise<LegacyShopCustomerMigrationReportRow[]>;
  list(actor: UserId, tenantId: string, shopId: string): Promise<ShopCustomerAccount[]>;
  findByNormalizedEmail(
    actor: UserId,
    tenantId: string,
    shopId: string,
    normalizedEmail: string,
  ): Promise<ShopCustomerAccount | null>;
  create(
    actor: UserId,
    tenantId: string,
    shopId: string,
    record: CreateShopCustomerRecord,
  ): Promise<ShopCustomerAccount>;
  ensureSelf(actor: UserId, tenantId: string, shopId: string): Promise<EnsureSelfShopCustomerResult>;
}
