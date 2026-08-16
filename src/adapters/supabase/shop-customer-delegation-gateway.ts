import type { SupabaseClient } from '@supabase/supabase-js';
import { selfShopCustomerDelegationResultSchema } from '../../modules/shop-customers/api/contracts.ts';
import type {
  IssuedShopCustomerDelegation,
  ShopCustomerDelegationGateway,
} from '../../modules/shop-customers/application/shop-customer-delegation-service.ts';
import type { Database } from '../../types/database.types.ts';

export class SupabaseShopCustomerDelegationGateway implements ShopCustomerDelegationGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async startSelf(
    _actorId: string,
    tenantId: string,
    shopId: string,
    reason: string | null,
    expiresInSeconds: number,
  ): Promise<IssuedShopCustomerDelegation | null> {
    const { data, error } = await this.client.rpc('api_start_self_shop_customer_delegation', {
      p_tenant_id: tenantId,
      p_shop_id: shopId,
      p_reason: reason,
      p_expires_seconds: expiresInSeconds,
    });
    if (error) throw new Error('La délégation storefront est indisponible.');
    const row = data?.[0];
    if (!row) return null;
    return {
      opaqueToken: row.opaque_token,
      maxAgeSeconds: Math.floor((Date.parse(row.expires_at) - Date.parse(row.issued_at)) / 1_000),
      result: selfShopCustomerDelegationResultSchema.parse({
        customer: {
          id: row.account_id,
          shopId: row.shop_id,
          email: row.email,
          normalizedEmail: row.normalized_email,
          fullName: row.full_name,
          authSubjectId: row.auth_subject_id,
          status: row.account_status,
          createdByMagritUserId: row.created_by_magrit_user_id,
          createdAt: row.account_created_at,
          activatedAt: row.activated_at,
          suspendedAt: row.suspended_at,
        },
        delegation: {
          id: row.delegation_id,
          shopId: row.shop_id,
          shopCustomerAccountId: row.account_id,
          actorMagritUserId: row.actor_magrit_user_id,
          issuedAt: row.issued_at,
          expiresAt: row.expires_at,
          revokedAt: null,
          reason: row.reason,
        },
        storefrontPath: `/shop/${row.shop_slug}`,
      }),
    };
  }
}
