import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { CommercialOverview } from '../../modules/commercial/api/contracts.ts';
import type { CommercialRepository } from '../../modules/commercial/application/commercial-repository.ts';

const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST205']);

export class SupabaseCommercialRepository implements CommercialRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async overview(_actor: UserId, tenantId: string): Promise<CommercialOverview> {
    const [rules, groups, members, gammes] = await Promise.all([
      this.client.from('client_price_rules').select('*').eq('tenant_id', tenantId).order('priority', { ascending: true }).order('created_at', { ascending: false }),
      this.client.from('client_groups').select('*, client_group_members(count)').eq('tenant_id', tenantId).order('name'),
      this.client.rpc('get_tenant_members_with_email', { p_tenant_id: tenantId }),
      this.client.from('product_gammes').select('slug, name').order('display_order'),
    ]);
    if (TABLE_MISSING_CODES.has(rules.error?.code ?? '') || TABLE_MISSING_CODES.has(groups.error?.code ?? '')) {
      return { available: false, rules: [], groups: [], members: [], gammes: [] };
    }
    const error = rules.error ?? groups.error ?? members.error ?? gammes.error;
    if (error) throw new Error(error.message);
    return {
      available: true,
      rules: rules.data ?? [],
      groups: (groups.data ?? []).map((group: any) => ({ ...group, member_count: group.client_group_members?.[0]?.count ?? 0 })),
      members: (members.data ?? []).map((member: any) => ({ user_id: member.user_id, email: member.email ?? '' })),
      gammes: (gammes.data ?? []).map((gamme: any) => ({ slug: gamme.slug, name: gamme.name })),
    };
  }
}
