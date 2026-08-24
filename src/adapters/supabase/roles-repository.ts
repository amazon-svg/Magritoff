import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { RoleCatalogDefinition, RolesCatalog, RolesOverview, SaveRoleDefinitionCommand, SetRoleAssignmentResult, UserAccessProfile, UserRolesDetail } from '../../modules/roles/api/contracts.ts';
import { RoleRejectedError, type RolesRepository } from '../../modules/roles/application/roles-repository.ts';
import type { Database } from '../../types/database.types.ts';

export class SupabaseRolesRepository implements RolesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async userCapability(_actor: UserId, tenantId: string, capability: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('user_has_capability', {
      p_tenant_id: tenantId,
      p_capability: capability,
    });
    if (error) throw rejected(error.message);
    return Boolean(data);
  }

  async accessProfile(actor: UserId, tenantId: string): Promise<UserAccessProfile> {
    const member = await this.client.from('tenant_members')
      .select('role, access_scope')
      .eq('tenant_id', tenantId)
      .eq('user_id', actor)
      .maybeSingle();
    if (member.error) throw rejected(member.error.message);
    if (!member.data || member.data.access_scope !== 'magrit_full') {
      throw new RoleRejectedError('member_not_found', 'Vous n appartenez pas a l equipe de cet espace.');
    }

    const membership: UserAccessProfile['membership'] = member.data.role === 'admin' ? 'admin' : 'member';
    const isAdmin = membership === 'admin';
    const capabilities = new Set<string>();

    if (!isAdmin) {
      const assigned = await this.client.from('tenant_role_assignments')
        .select('tenant_role_definitions!inner(tenant_id, archived_at, identity_context, capabilities)')
        .eq('user_id', actor)
        .is('revoked_at', null)
        .eq('tenant_role_definitions.tenant_id', tenantId)
        .eq('tenant_role_definitions.identity_context', 'magrit')
        .is('tenant_role_definitions.archived_at', null);
      if (assigned.error) throw rejected(assigned.error.message);
      for (const row of assigned.data ?? []) {
        const definition = row.tenant_role_definitions as unknown as { capabilities: Record<string, boolean> | null };
        for (const [name, granted] of Object.entries(definition.capabilities ?? {})) {
          if (granted) capabilities.add(name);
        }
      }
    }

    return {
      tenantId,
      userId: actor,
      membership,
      isAdmin,
      surfaces: isAdmin ? ['workspace', 'backoffice'] : ['workspace'],
      capabilities: [...capabilities].sort(),
    };
  }

  async overview(_actor: UserId, tenantId: string): Promise<RolesOverview> {
    const [roles, members] = await Promise.all([this.loadRoles(tenantId), this.loadMembers(tenantId)]);
    const assignments = await this.loadAssignments(roles.map((role) => role.id));
    return { roles, members, assignments };
  }

  async catalog(_actor: UserId, tenantId: string): Promise<RolesCatalog> {
    const [roles, members] = await Promise.all([this.loadCatalogRoles(tenantId), this.loadMembers(tenantId)]);
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
      this.client.from('tenant_role_definitions').select('id, system_key').eq('id', roleId)
        .eq('tenant_id', tenantId).eq('identity_context', 'magrit')
        .is('archived_at', null).maybeSingle(),
      this.client.from('tenant_members').select('user_id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle(),
    ]);
    if (role.error || member.error) throw rejected(role.error?.message ?? member.error?.message ?? 'Accès refusé.');
    if (!role.data) throw new RoleRejectedError('role_not_found', 'Rôle introuvable.');
    if (role.data.system_key !== 'option_shops' && role.data.system_key !== 'option_orders') {
      throw new RoleRejectedError('invalid_definition', 'Seules les options Boutiques et Commandes sont assignables à un utilisateur Magrit.');
    }
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
    const { data: revoked, error } = await this.client.from('tenant_role_assignments')
      .update({ revoked_at: new Date().toISOString(), revoked_by: actor })
      .eq('id', current!.id).select('id').maybeSingle();
    if (error) throw rejected(error.message);
    if (!revoked) throw new RoleRejectedError('permission_denied', 'Révocation interdite.');
    return { active: false, assignmentId: null };
  }

  async createDefinition(actor: UserId, tenantId: string, command: SaveRoleDefinitionCommand): Promise<RoleCatalogDefinition> {
    await this.validateScopeShop(tenantId, command);
    const { data, error } = await this.client.from('tenant_role_definitions').insert({
      tenant_id: tenantId,
      created_by: actor,
      ...definitionPayload(command),
    }).select(CATALOG_COLUMNS).single();
    if (error || !data) throw classified(error, 'Création du rôle impossible.');
    return mapCatalogRole(data);
  }

  async updateDefinition(_actor: UserId, tenantId: string, roleId: string, command: SaveRoleDefinitionCommand): Promise<RoleCatalogDefinition> {
    await this.validateScopeShop(tenantId, command);
    const { data, error } = await this.client.from('tenant_role_definitions')
      .update(definitionPayload(command))
      .eq('tenant_id', tenantId).eq('id', roleId)
      .select(CATALOG_COLUMNS).maybeSingle();
    if (error) throw classified(error, 'Modification du rôle impossible.');
    if (!data) throw new RoleRejectedError('role_not_found', 'Rôle introuvable.');
    return mapCatalogRole(data);
  }

  async archiveDefinition(_actor: UserId, tenantId: string, roleId: string): Promise<void> {
    const { data: role, error: roleError } = await this.client.from('tenant_role_definitions')
      .select('id, name').eq('tenant_id', tenantId).eq('id', roleId).maybeSingle();
    if (roleError) throw classified(roleError, 'Lecture du rôle impossible.');
    if (!role) throw new RoleRejectedError('role_not_found', 'Rôle introuvable.');
    if (CANONICAL_ROLES.has(role.name)) throw new RoleRejectedError('canonical_role', 'Un rôle canonique ne peut pas être archivé.');
    const { data: archived, error } = await this.client.from('tenant_role_definitions')
      .update({ archived_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', roleId)
      .select('id').maybeSingle();
    if (error) throw classified(error, 'Archivage du rôle impossible.');
    if (!archived) throw new RoleRejectedError('permission_denied', 'Archivage interdit.');
  }

  async reorderDefinitions(_actor: UserId, tenantId: string, firstRoleId: string, secondRoleId: string): Promise<void> {
    const { error } = await this.client.rpc('api_swap_tenant_role_order', {
      p_first_role_id: firstRoleId,
      p_second_role_id: secondRoleId,
      p_tenant_id: tenantId,
    });
    if (error) throw classified(error, 'Réordonnancement impossible.');
  }

  private async loadRoles(tenantId: string) {
    const { data, error } = await this.client.from('tenant_role_definitions')
      .select('id, name, description, capabilities, ordering_index, system_key')
      .eq('tenant_id', tenantId).eq('identity_context', 'magrit')
      .is('archived_at', null).order('ordering_index');
    if (error) throw rejected(error.message);
    return (data ?? []).map((role) => ({ id: role.id, name: role.name, description: role.description ?? '', capabilities: toCapabilities(role.capabilities), orderingIndex: role.ordering_index, systemKey: role.system_key ?? null }));
  }
  private async loadCatalogRoles(tenantId: string): Promise<RoleCatalogDefinition[]> {
    const { data, error } = await this.client.from('tenant_role_definitions')
      .select(CATALOG_COLUMNS).eq('tenant_id', tenantId)
      .eq('identity_context', 'magrit').order('ordering_index');
    if (error) throw classified(error, 'Chargement du catalogue impossible.');
    return (data ?? []).map(mapCatalogRole);
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
  private async validateScopeShop(tenantId: string, command: SaveRoleDefinitionCommand): Promise<void> {
    if (command.scope !== 'shop' || !command.scopeShopId) return;
    const { data, error } = await this.client.from('shops').select('id')
      .eq('tenant_id', tenantId).eq('id', command.scopeShopId).maybeSingle();
    if (error) throw classified(error, 'Validation de la boutique impossible.');
    if (!data) throw new RoleRejectedError('invalid_definition', 'La boutique de portée n’appartient pas à cet espace.');
  }
}

const CATALOG_COLUMNS = 'id, tenant_id, name, description, capabilities, notify_policy, scope, scope_shop_id, ordering_index, archived_at, system_key' as const;
const CANONICAL_ROLES = new Set(['Owner', 'Admin', 'Acheteur', 'Producteur']);

function definitionPayload(command: SaveRoleDefinitionCommand) {
  return {
    name: command.name,
    description: command.description,
    capabilities: command.capabilities,
    notify_policy: command.notifyPolicy,
    scope: command.scope,
    scope_shop_id: command.scopeShopId,
    ordering_index: command.orderingIndex,
  };
}

function mapCatalogRole(role: {
  id: string; tenant_id: string; name: string; description: string | null;
  capabilities: unknown; notify_policy: string; scope: string;
  scope_shop_id: string | null; ordering_index: number; archived_at: string | null;
  system_key: string | null;
}): RoleCatalogDefinition {
  return {
    id: role.id,
    tenantId: role.tenant_id,
    name: role.name,
    systemKey: role.system_key,
    description: role.description ?? '',
    capabilities: toCapabilities(role.capabilities),
    notifyPolicy: role.notify_policy === 'all_roles' || role.notify_policy === 'none' ? role.notify_policy : 'chain_next',
    scope: role.scope === 'shop' ? 'shop' : 'tenant',
    scopeShopId: role.scope_shop_id,
    orderingIndex: role.ordering_index,
    archivedAt: role.archived_at,
  };
}

function toCapabilities(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
}
function rejected(message: string): RoleRejectedError { return new RoleRejectedError('permission_denied', message); }
function classified(error: { code?: string; message?: string } | null, fallback: string): RoleRejectedError {
  if (error?.code === '23505') return new RoleRejectedError('definition_conflict', 'Un rôle portant ce nom existe déjà.');
  if (error?.code === '23514' || error?.code === '22P02' || error?.code === '22023') return new RoleRejectedError('invalid_definition', error.message ?? fallback);
  if (error?.code === 'P0002') return new RoleRejectedError('role_not_found', error.message ?? fallback);
  return rejected(error?.message ?? fallback);
}
