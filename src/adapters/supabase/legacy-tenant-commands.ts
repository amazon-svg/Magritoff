import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../utils/supabase/client';
import type { Database, Json } from '../../types/database.types';

type Client = SupabaseClient<Database>;

export class LegacyTenantCommands {
  constructor(private readonly client: Client) {}

  async createTenant(input: {
    slug: string;
    name: string;
    parentTenantId: string | null;
  }): Promise<string> {
    const { data, error } = await this.client.rpc('create_tenant_with_owner', {
      p_slug: input.slug,
      p_name: input.name,
      ...(input.parentTenantId === null ? {} : { p_parent_tenant_id: input.parentTenantId }),
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async markTenantVerified(
    tenantId: string,
    siren: string,
    sirenData: Json,
  ): Promise<void> {
    const { error } = await this.client
      .from('tenants')
      .update({
        siren,
        siren_data: sirenData,
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', tenantId);
    if (error) throw new Error(error.message);
  }

  async activateGammes(tenantId: string, gammeSlugs: readonly string[]): Promise<void> {
    const { error } = await this.client.from('tenant_gamme_subscriptions').upsert(
      gammeSlugs.map((gamme_slug) => ({ tenant_id: tenantId, gamme_slug, active: true })),
      { onConflict: 'tenant_id,gamme_slug' },
    );
    if (error) throw new Error(error.message);
  }

  async acceptInvitation(token: string): Promise<string> {
    const { data, error } = await this.client.rpc('accept_tenant_invitation', { p_token: token });
    if (error) throw new Error(error.message);
    return data;
  }
}

export const legacyTenantCommands = new LegacyTenantCommands(supabase);
