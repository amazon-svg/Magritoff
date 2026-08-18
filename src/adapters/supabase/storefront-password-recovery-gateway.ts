import type { SupabaseClient } from '@supabase/supabase-js';
import type { StorefrontPasswordRecoveryGateway } from '../../modules/shop-customers/application/storefront-password-recovery-service.ts';
import type { Database } from '../../types/database.types.ts';

export class SupabaseStorefrontPasswordRecoveryGateway implements StorefrontPasswordRecoveryGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async issue(shopSlug: string, normalizedEmail: string) {
    const { data, error } = await this.client.rpc('api_issue_shop_customer_password_recovery', { p_shop_slug: shopSlug, p_email: normalizedEmail });
    if (error) throw new Error('La récupération du compte boutique est indisponible.');
    const row = data?.[0];
    return row ? { token: row.opaque_token, customerEmail: row.email, customerName: row.full_name, shopName: row.shop_name, shopSlug: row.shop_slug } : null;
  }
  async reset(token: string, password: string) {
    const { data, error } = await this.client.rpc('api_reset_shop_customer_password', { p_token: token, p_password: password });
    if (error) throw new Error('La réinitialisation du compte boutique est indisponible.');
    return data === true;
  }
}
