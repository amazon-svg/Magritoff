import type { SupabaseClient } from '@supabase/supabase-js';
import type { StorefrontActivationGateway } from '../../modules/shop-customers/application/storefront-activation-service.ts';
import type { Database } from '../../types/database.types.ts';
import { mapStorefrontIssuedSession } from './storefront-authentication-gateway.ts';

export class SupabaseStorefrontActivationGateway implements StorefrontActivationGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async issue(_actorId: string, tenantId: string, shopId: string, accountId: string, expiresInSeconds: number) {
    const { data, error } = await this.client.rpc('api_issue_shop_customer_activation', {
      p_tenant_id: tenantId, p_shop_id: shopId, p_account_id: accountId, p_expires_seconds: expiresInSeconds,
    });
    if (error) throw new Error('L’émission du lien d’activation est indisponible.');
    if (!data) return null;
    const [accountResult, shopResult] = await Promise.all([
      this.client.from('shop_customer_accounts').select('email, full_name')
        .eq('id', accountId).eq('shop_id', shopId).maybeSingle(),
      this.client.from('shops').select('name, slug')
        .eq('id', shopId).eq('tenant_id', tenantId).maybeSingle(),
    ]);
    if (accountResult.error || shopResult.error || !accountResult.data || !shopResult.data) {
      throw new Error('Le destinataire du lien d’activation est indisponible.');
    }
    return {
      token: data,
      customerEmail: accountResult.data.email,
      customerName: accountResult.data.full_name,
      shopName: shopResult.data.name,
      shopSlug: shopResult.data.slug,
    };
  }
  async activate(token: string, password: string) {
    const { data, error } = await this.client.rpc('api_activate_shop_customer', { p_token: token, p_password: password });
    if (error) throw new Error('L’activation du compte boutique est indisponible.');
    const row = data?.[0];
    return row ? mapStorefrontIssuedSession(row) : null;
  }
}
