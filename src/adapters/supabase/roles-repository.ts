import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { RolesOverview, SetRoleAssignmentResult, UserRolesDetail } from '../../modules/roles/api/contracts.ts';
import { RoleRejectedError, type RolesRepository } from '../../modules/roles/application/roles-repository.ts';
import type { Database } from '../../types/database.types.ts';

export class SupabaseRolesRepository implements RolesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async overview(_actor: UserId, tenantId: string): Promise<RolesOverview> {
    const [roles, members] = await Promise.all([this.loadRoles(tenantId), this.loadMembers(tenantId)]);
    const assignments = await this.loadAssignments(roles.map((role) => role.id));
    return { roles, members, assignments };
  }

  async userDetail(_actor: UserId, tenantId: string, userId: string): Promise<UserRolesDetail> {
    const [roles, shopsResult, memberResult] = await Promise.all([
      this.loadRoles(tenantId),
      this.client.from('shops').select('id, name').eq('tenant_id', tenantId).order('name'),
      this.client.from('tenant_members').select('access_scope, allowed_shop_ids').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle(),
    ]);
    if (shopsResult.error) throw rejected(shopsResult.error.message);
    if (memberResult.error) throw rejected(memberResult.error.message);
    if (!memberResult.data) throw new RoleRejectedError('member_not_found', 'Membre introuvable.');
    const assignments = (await this.loadAssignments(roles.map((role) => role.id))).filter((assignment) => assignment.userId === userId);
    return {
      roles, assignments, shops: shopsResult.data ?? [],
      accessScope: memberResult.data.access_scope === 'shop_only' ? 'shop_only' : 'magrit_full',
      allowedShopIds: memberResult.data.allowed_shop_ids ?? [],
    };
  }

  async setAssignment(actor: UserId, tenantId: string, userId: string, roleId: string, active: boolean): Promise<SetRoleAssignmentResult> {
    const [role, member] = await Promise.all([
      this.client.from('tenant_role_definitions').select('id').eq('id', roleId).eq('tenant_id', tenantId).is('archived_at', null).maybeSingle(),
      this.client.from('tenant_members').select('user_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle(),
    ]);
    if (role.error || member.error) throw rejected(role.error?.message ?? member.error?.message ?? 'Accès refusé.');
    if (!role.data) throw new RoleRejectedError('role_not_found', 'Rôle introuvable.');
    if (!member.data) throw new RoleRejectedError('member_not_found', 'Membre introuvable.');

    const { data: current, error: currentError } = await this.client.from('tenant_role_assignments')
      .select('id').eq('role_definition_id', roleId).eq('user_id', userId).is('revoked_at', null).maybeSingle();
    if (currentError) throw rejected(currentError.message);
    if (active && current) return { active: true, assignmentId: current.id };
    if (!active && !current) return { active: false, assignmentId: null };

    if (active) {
      const { data, error } = await this.client.from('tenant_role_assignments').insert({ role_definition_id: roleId, user_id: userId, assigned_by: actor }).select('id').single();
      if (error || !data) throw rejected(error?.message ?? 'Assignation impossible.');
      return { active: true, assignmentId: data.id };
    }
    const { error } = await this.client.from('tenant_role_assignments').update({ revoked_at: new Date().toISOString(), revoked_by: actor }).eq('id', current!.id);
    if (error) throw rejected(error.message);
    return { active: false, assignmentId: null };
  }

  private async loadRoles(tenantId: string) {
    const { data, error } = await this.client.from('tenant_role_definitions').select('id, name, description, capabilities, ordering_index').eq('tenant_id', tenantId).is('archived_at', null).order('ordering_index');
    if (error) throw rejected(error.message);
    return (data ?? []).map((role) => ({ id: role.id, name: role.name, description: role.description ?? '', capabilities: toCapabilities(role.capabilities), orderingIndex: role.ordering_index }));
  }
  private async loadMembers(tenantId: string) {
    const { data, error } = await this.client.rpc('get_tenant_members_with_email', { p_tenant_id: tenantId });
    if (error) throw rejected(error.message);
    return (data ?? []).map((member) => ({ userId: member.user_id, email: member.email, legacyRole: member.role }));
  }
  private async loadAssignments(roleIds: string[]) {
    if (roleIds.length === 0) return [];
    const { data, error } = await this.client.from('tenant_role_assignments').select('id, role_definition_id, user_id').in('role_definition_id', roleIds).is('revoked_at', null);
    if (error) throw rejected(error.message);
    return (data ?? []).map((assignment) => ({ id: assignment.id, roleId: assignment.role_definition_id, userId: assignment.user_id }));
  }
}

function toCapabilities(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
}
function rejected(message: string): RoleRejectedError { return new RoleRejectedError('permission_denied', message); }
