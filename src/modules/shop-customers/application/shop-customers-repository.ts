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
  /** E10.5 CA3 — interlocuteur a l origine de l ouverture, ou `null`/absent. */
  customerContactId?: string | null;
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
  /** E10.5 — l acces boutique deja ouvert pour cet interlocuteur, dans CETTE boutique. */
  findByCustomerContactId(
    actor: UserId,
    tenantId: string,
    shopId: string,
    customerContactId: string,
  ): Promise<ShopCustomerAccount | null>;
  /** E10.5 — tous les acces boutique ouverts pour cet interlocuteur, toutes boutiques du tenant confondues. */
  listByCustomerContactId(actor: UserId, customerContactId: string): Promise<ShopCustomerAccount[]>;
  /** E10.5 — relie un compte boutique existant (email trouve, non lie) a l interlocuteur. */
  linkCustomerContact(
    actor: UserId,
    accountId: string,
    customerContactId: string,
  ): Promise<ShopCustomerAccount>;
  /** E10.5 — revoque l acces : delie l interlocuteur et suspend le compte. */
  revokeCustomerContactAccess(
    actor: UserId,
    tenantId: string,
    shopId: string,
    customerContactId: string,
  ): Promise<void>;
}
