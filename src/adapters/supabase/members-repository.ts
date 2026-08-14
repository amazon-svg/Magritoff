import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { ChangeMemberRoleCommand, TenantMember, UpdateMemberAccessCommand } from '../../modules/members/api/contracts.ts';
import { MemberRejectedError, type MembersRepository } from '../../modules/members/application/members-repository.ts';
import type { Database, Json } from '../../types/database.types.ts';

export class SupabaseMembersRepository implements MembersRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async list(_actor: UserId, tenantId: string): Promise<TenantMember[]> {
    const { data, error } = await this.client.rpc('get_tenant_members_with_email', { p_tenant_id: tenantId });
    if (error) throw new MemberRejectedError('permission_denied', error.message);
    return (data ?? []).map((row) => {
      const permissions = row.permissions as Record<string, unknown> | null;
      return {
        userId: row.user_id, email: row.email, role: toRole(row.role), joinedAt: row.joined_at,
        accessScope: row.access_scope === 'shop_only' ? 'shop_only' : 'magrit_full',
        allowedShopIds: row.allowed_shop_ids ?? [],
        permissions: { canQuote: permissions?.can_quote !== false, canOrder: permissions?.can_order !== false, canInvite: permissions?.can_invite === true },
      };
    });
  }

  async changeRole(actor: UserId, tenantId: string, userId: string, command: ChangeMemberRoleCommand): Promise<void> {
    const member = await this.requireMutableMember(tenantId, userId);
    const { error } = await this.client.from('tenant_members').update({ role: command.role }).eq('tenant_id', tenantId).eq('user_id', userId);
    if (error) throw new MemberRejectedError('permission_denied', error.message);
    await this.audit(actor, tenantId, userId, 'role_changed', { old_role: member.role, new_role: command.role });
  }

  async updateAccess(actor: UserId, tenantId: string, userId: string, command: UpdateMemberAccessCommand): Promise<void> {
    const member = await this.requireMutableMember(tenantId, userId);
    const { error } = await this.client.from('tenant_members').update({
      access_scope: command.accessScope,
      allowed_shop_ids: command.accessScope === 'shop_only' ? command.allowedShopIds : [],
      permissions: { can_quote: command.permissions.canQuote, can_order: command.permissions.canOrder, can_invite: command.permissions.canInvite },
    }).eq('tenant_id', tenantId).eq('user_id', userId);
    if (error) throw new MemberRejectedError('permission_denied', error.message);
    await this.audit(actor, tenantId, userId, 'role_changed', { access_scope_changed: { from: member.access_scope, to: command.accessScope }, permissions: command.permissions });
  }

  async remove(actor: UserId, tenantId: string, userId: string): Promise<void> {
    const member = await this.requireMutableMember(tenantId, userId);
    const { error } = await this.client.from('tenant_members').delete().eq('tenant_id', tenantId).eq('user_id', userId);
    if (error) throw new MemberRejectedError('permission_denied', error.message);
    await this.audit(actor, tenantId, userId, 'removed', { old_role: member.role });
  }

  private async requireMutableMember(tenantId: string, userId: string) {
    const { data, error } = await this.client.from('tenant_members').select('role, access_scope').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
    if (error) throw new MemberRejectedError('permission_denied', error.message);
    if (!data) throw new MemberRejectedError('member_not_found', 'Membre introuvable.');
    // Le dernier moyen d administrer l espace ne peut pas disparaître (spec
    // access-management, règle 7) : le dernier admin n est ni rétrogradable
    // ni retirable.
    if (data.role === 'admin') {
      const { count, error: countError } = await this.client
        .from('tenant_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('role', 'admin')
        .neq('user_id', userId);
      if (countError) throw new MemberRejectedError('permission_denied', countError.message);
      if ((count ?? 0) === 0) {
        throw new MemberRejectedError('last_admin_protected', 'Le dernier admin de l espace ne peut pas être modifié ou retiré.');
      }
    }
    return data;
  }

  private async audit(actor: UserId, tenantId: string, targetUserId: string, eventType: 'role_changed' | 'removed', metadata: Json) {
    const { error } = await this.client.from('tenant_member_events').insert({ tenant_id: tenantId, target_user_id: targetUserId, event_type: eventType, performed_by: actor, metadata });
    if (error) throw new Error(`Mutation appliquée mais audit impossible: ${error.message}`);
  }
}

function toRole(value: string): 'admin' | 'member' {
  return value === 'admin' ? value : 'member';
}
