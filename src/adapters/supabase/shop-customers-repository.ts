import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import { ensureSelfShopCustomerResultSchema, legacyShopCustomerMigrationReportSchema, shopCustomerAccountSchema, type EnsureSelfShopCustomerResult, type LegacyShopCustomerMigrationReportRow, type ShopCustomerAccount } from '../../modules/shop-customers/api/contracts.ts';
import {
  ShopCustomerRejectedError,
  type CreateShopCustomerRecord,
  type ShopCustomersRepository,
} from '../../modules/shop-customers/application/shop-customers-repository.ts';
import type { Database } from '../../types/database.types.ts';

const ACCOUNT_COLUMNS = 'id, shop_id, email, normalized_email, full_name, auth_subject_id, status, created_by_magrit_user_id, created_at, activated_at, suspended_at' as const;

export class SupabaseShopCustomersRepository implements ShopCustomersRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async migrationReport(
    _actor: UserId,
    tenantId: string,
  ): Promise<LegacyShopCustomerMigrationReportRow[]> {
    const { data, error } = await this.client.rpc(
      'api_get_legacy_shop_customer_migration_report',
      { p_tenant_id: tenantId },
    );
    if (error) throw rejected(error);
    return legacyShopCustomerMigrationReportSchema.parse((data ?? []).map((row) => ({
      legacyUserId: row.legacy_user_id,
      shopId: row.shop_id,
      normalizedEmail: row.normalized_email,
      proposedAction: row.proposed_action,
      targetAccountId: row.target_account_id,
      migrationOutcome: row.migration_outcome,
      ordersLinkedCount: row.orders_linked_count,
      lastAttemptAt: row.last_attempt_at,
    })));
  }

  async list(
    _actor: UserId,
    tenantId: string,
    shopId: string,
  ): Promise<ShopCustomerAccount[]> {
    await this.requireShop(tenantId, shopId);
    const { data, error } = await this.client.from('shop_customer_accounts')
      .select(ACCOUNT_COLUMNS)
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (error) throw rejected(error);
    return (data ?? []).map(mapAccount);
  }

  async findByNormalizedEmail(
    _actor: UserId,
    tenantId: string,
    shopId: string,
    normalizedEmail: string,
  ): Promise<ShopCustomerAccount | null> {
    await this.requireShop(tenantId, shopId);
    const { data, error } = await this.client.from('shop_customer_accounts')
      .select(ACCOUNT_COLUMNS)
      .eq('shop_id', shopId)
      .eq('normalized_email', normalizedEmail)
      .maybeSingle();
    if (error) throw rejected(error);
    return data ? mapAccount(data) : null;
  }

  async create(
    _actor: UserId,
    tenantId: string,
    shopId: string,
    record: CreateShopCustomerRecord,
  ): Promise<ShopCustomerAccount> {
    await this.requireShop(tenantId, shopId);
    const { data, error } = await this.client.from('shop_customer_accounts').insert({
      shop_id: shopId,
      email: record.email,
      full_name: record.fullName,
      status: record.status,
      created_by_magrit_user_id: record.createdByMagritUserId,
    }).select(ACCOUNT_COLUMNS).single();
    if (error || !data) throw rejected(error ?? { message: 'Création impossible.' });
    const account = mapAccount(data);
    if (account.normalizedEmail !== record.normalizedEmail) {
      throw new ShopCustomerRejectedError('invalid_request', 'Normalisation email incohérente.');
    }
    return account;
  }

  async ensureSelf(
    _actor: UserId,
    tenantId: string,
    shopId: string,
  ): Promise<EnsureSelfShopCustomerResult> {
    const { data, error } = await this.client.rpc('api_ensure_self_shop_customer', {
      p_tenant_id: tenantId,
      p_shop_id: shopId,
    });
    if (error) throw rejected(error);
    const row = data?.[0];
    if (!row) throw new ShopCustomerRejectedError(
      'permission_denied',
      'Création du compte miroir interdite ou identité Magrit incomplète.',
    );
    return ensureSelfShopCustomerResultSchema.parse({
      customer: {
        id: row.account_id,
        shopId: row.shop_id,
        email: row.email,
        normalizedEmail: row.normalized_email,
        fullName: row.full_name,
        authSubjectId: row.auth_subject_id,
        status: row.status,
        createdByMagritUserId: row.created_by_magrit_user_id,
        createdAt: row.created_at,
        activatedAt: row.activated_at,
        suspendedAt: row.suspended_at,
      },
      created: row.created,
    });
  }

  private async requireShop(tenantId: string, shopId: string): Promise<void> {
    const { data, error } = await this.client.from('shops').select('id')
      .eq('tenant_id', tenantId)
      .eq('id', shopId)
      .maybeSingle();
    if (error) throw rejected(error);
    if (!data) throw new ShopCustomerRejectedError(
      'shop_not_found',
      'Boutique introuvable dans cet espace.',
    );
  }
}

function mapAccount(row: Database['public']['Tables']['shop_customer_accounts']['Row']): ShopCustomerAccount {
  return shopCustomerAccountSchema.parse({
    id: row.id,
    shopId: row.shop_id,
    email: row.email,
    normalizedEmail: row.normalized_email,
    fullName: row.full_name,
    authSubjectId: row.auth_subject_id,
    status: row.status,
    createdByMagritUserId: row.created_by_magrit_user_id,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    suspendedAt: row.suspended_at,
  });
}

function rejected(error: { message: string; code?: string | undefined }): ShopCustomerRejectedError {
  if (error.code === '23505') {
    return new ShopCustomerRejectedError(
      'duplicate_email',
      'Un compte existe déjà pour cet email dans cette boutique.',
    );
  }
  return new ShopCustomerRejectedError('permission_denied', error.message);
}
