import type { SupabaseClient } from '@supabase/supabase-js';
import type { StorefrontActivationGateway } from '../../modules/shop-customers/application/storefront-activation-service.ts';
import type { Database } from '../../types/database.types.ts';

export class SupabaseStorefrontActivationGateway implements StorefrontActivationGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}
  async issue(_actorId: string, tenantId: string, shopId: string, accountId: string, expiresInSeconds: number) {
    const { data, error } = await this.client.rpc('api_issue_shop_customer_activation', {
      p_tenant_id: tenantId, p_shop_id: shopId, p_account_id: accountId, p_expires_seconds: expiresInSeconds,
    });
    if (error) throw new Error('L’émission du lien d’activation est indisponible.');
    return data;
  }
  async activate(token: string, password: string) {
    const { data, error } = await this.client.rpc('api_activate_shop_customer', { p_token: token, p_password: password });
    if (error) throw new Error('L’activation du compte boutique est indisponible.');
    return data === true;
  }
}
