import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { ClientGroupDto, ClientPriceRuleDto, CommercialOverview, CreatePriceRule } from '../../modules/commercial/api/contracts.ts';
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
      rules: (rules.data ?? []).map(toRule),
      groups: (groups.data ?? []).map((group: any) => ({ ...group, member_count: group.client_group_members?.[0]?.count ?? 0 })),
      members: (members.data ?? []).map((member: any) => ({ user_id: member.user_id, email: member.email ?? '' })),
      gammes: (gammes.data ?? []).map((gamme: any) => ({ slug: gamme.slug, name: gamme.name })),
    };
  }

  async createGroup(_actor: UserId, tenantId: string, name: string): Promise<ClientGroupDto> {
    const { data, error } = await this.client.from('client_groups').insert({ tenant_id: tenantId, name }).select().single();
    if (error || !data) throw new Error(error?.message ?? 'Création du groupe impossible.');
    return { ...data, member_count: 0 };
  }
  async removeGroup(_actor: UserId, tenantId: string, groupId: string): Promise<void> {
    const { data, error } = await this.client.from('client_groups').delete().eq('tenant_id', tenantId).eq('id', groupId).select('id').maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Groupe introuvable.');
  }
  async groupMembers(_actor: UserId, tenantId: string, groupId: string): Promise<string[]> {
    await this.assertGroup(tenantId, groupId);
    const { data, error } = await this.client.from('client_group_members').select('user_id').eq('group_id', groupId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((member: any) => member.user_id);
  }
  async setGroupMember(_actor: UserId, tenantId: string, groupId: string, userId: string, member: boolean): Promise<void> {
    await this.assertGroup(tenantId, groupId);
    const result = member
      ? await this.client.from('client_group_members').upsert({ group_id: groupId, user_id: userId })
      : await this.client.from('client_group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (result.error) throw new Error(result.error.message);
  }
  async createRule(actor: UserId, tenantId: string, input: CreatePriceRule): Promise<ClientPriceRuleDto> {
    const { data, error } = await this.client.from('client_price_rules').insert({ ...input, tenant_id: tenantId, created_by: actor }).select().single();
    if (error || !data) throw new Error(error?.message ?? 'Création de la règle impossible.');
    return toRule(data);
  }
  async setRuleActive(_actor: UserId, tenantId: string, ruleId: string, active: boolean): Promise<ClientPriceRuleDto> {
    const { data, error } = await this.client.from('client_price_rules').update({ active, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', ruleId).select().maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Règle introuvable.');
    return toRule(data);
  }
  async removeRule(_actor: UserId, tenantId: string, ruleId: string): Promise<void> {
    const { data, error } = await this.client.from('client_price_rules').delete().eq('tenant_id', tenantId).eq('id', ruleId).select('id').maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Règle introuvable.');
  }
  private async assertGroup(tenantId: string, groupId: string): Promise<void> {
    const { data, error } = await this.client.from('client_groups').select('id').eq('tenant_id', tenantId).eq('id', groupId).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Groupe introuvable.');
  }
}

function toRule(rule: any): ClientPriceRuleDto {
  return { ...rule, value: Number(rule.value), priority: Number(rule.priority) };
}
