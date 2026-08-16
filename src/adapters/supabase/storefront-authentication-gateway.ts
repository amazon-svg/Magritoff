import type { SupabaseClient } from '@supabase/supabase-js';
import { storefrontSessionSchema } from '../../modules/shop-customers/api/contracts.ts';
import type { IssuedStorefrontSession, StorefrontAuthenticationGateway } from '../../modules/shop-customers/application/storefront-authentication-service.ts';
import type { Database } from '../../types/database.types.ts';

type AuthenticationRow = Database['public']['Functions']['api_authenticate_shop_customer']['Returns'][number];

export class SupabaseStorefrontAuthenticationGateway implements StorefrontAuthenticationGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async authenticate(shopSlug: string, normalizedEmail: string, password: string): Promise<IssuedStorefrontSession | null> {
    const { data, error } = await this.client.rpc('api_authenticate_shop_customer', {
      p_shop_slug: shopSlug, p_email: normalizedEmail, p_password: password,
    });
    if (error) throw new Error('La primitive d’authentification storefront est indisponible.');
    const row = data?.[0];
    return row ? mapIssuedSession(row) : null;
  }
}

function mapIssuedSession(row: AuthenticationRow): IssuedStorefrontSession {
  const maxAgeSeconds = Math.floor((Date.parse(row.expires_at) - Date.parse(row.issued_at)) / 1_000);
  return {
    opaqueToken: row.opaque_token,
    maxAgeSeconds,
    session: storefrontSessionSchema.parse({
      identity: { kind: 'shop_customer', shopId: row.shop_id, shopCustomerAccountId: row.account_id },
      customer: { id: row.account_id, shopId: row.shop_id, email: row.email, fullName: row.full_name, status: row.account_status },
      expiresAt: row.expires_at,
    }),
  };
}
