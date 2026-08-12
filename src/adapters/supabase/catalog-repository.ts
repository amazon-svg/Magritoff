import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { GammeSubscription, SetGammeSubscriptionsCommand } from '../../modules/catalog/api/contracts.ts';
import { CatalogRejectedError, type CatalogRepository } from '../../modules/catalog/application/catalog-repository.ts';
import type { Database } from '../../types/database.types.ts';

export class SupabaseCatalogRepository implements CatalogRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async gammeSubscriptions(_actor: UserId, tenantId: string): Promise<GammeSubscription[]> {
    const { data, error } = await this.client.from('tenant_gamme_subscriptions')
      .select('gamme_slug, active, display_order').eq('tenant_id', tenantId).order('display_order');
    if (error) throw classified(error, 'Lecture des souscriptions de gammes impossible.');
    return (data ?? []).map(mapSubscription);
  }

  async setGammeSubscriptions(actor: UserId, tenantId: string, command: SetGammeSubscriptionsCommand): Promise<GammeSubscription[]> {
    const { error } = await this.client.from('tenant_gamme_subscriptions').upsert(
      command.subscriptions.map((item) => ({ tenant_id: tenantId, gamme_slug: item.gammeSlug, active: item.active, added_by: actor })),
      { onConflict: 'tenant_id,gamme_slug' },
    );
    if (error) throw classified(error, 'Modification des souscriptions de gammes impossible.');
    return this.gammeSubscriptions(actor, tenantId);
  }
}

type SubscriptionRow = Database['public']['Tables']['tenant_gamme_subscriptions']['Row'];
function mapSubscription(row: Pick<SubscriptionRow, 'gamme_slug' | 'active' | 'display_order'>): GammeSubscription {
  return { gammeSlug: row.gamme_slug, active: row.active, displayOrder: row.display_order };
}
function classified(error: { code?: string; message?: string }, fallback: string) {
  if (error.code === '23503' || error.code === '23514') return new CatalogRejectedError('invalid_request', error.message ?? fallback);
  return new CatalogRejectedError('permission_denied', error.message ?? fallback);
}
