import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type {
  SessionUserPreferences,
  UpdatePreferences,
  UpdateTenantSettings,
} from '../../modules/session/api/contracts.ts';
import { SessionTenantMutationError, type DirectMembership, type SessionRepository } from '../../modules/session/application/session-repository.ts';
import type { Database } from '../../types/database.types.ts';

type UserScopedClient = SupabaseClient<Database>;
type TenantRow = Database['public']['Tables']['tenants']['Row'];
type PreferencesRow = Database['public']['Tables']['user_preferences']['Row'];

export class SupabaseSessionRepository implements SessionRepository {
  constructor(private readonly client: UserScopedClient) {}

  async autoAcceptPendingInvitations(): Promise<void> {
    const { error } = await this.client.rpc('auto_accept_pending_invitations');
    if (error) console.warn('[SessionRepository] auto-accept ignoré:', error.message);
  }

  async listDirectMemberships(userId: UserId): Promise<readonly DirectMembership[]> {
    const { data, error } = await this.client
      .from('tenant_members')
      .select('role, access_scope, allowed_shop_ids, permissions, tenant:tenants!inner(*)')
      .eq('user_id', userId);
    if (error) throw new Error(`Lecture des memberships impossible: ${error.message}`);

    return (data ?? []).map((membership) => ({
      tenant: toTenant(membership.tenant as unknown as TenantRow),
      role: normalizeRole(membership.role),
      accessScope: membership.access_scope === 'shop_only' ? 'shop_only' : 'magrit_full',
      allowedShopIds: membership.allowed_shop_ids ?? [],
      permissions: toPermissions(membership.permissions),
    }));
  }

  async listChildren(parentTenantIds: readonly string[]) {
    if (parentTenantIds.length === 0) return [];
    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .in('parent_tenant_id', [...parentTenantIds]);
    if (error) throw new Error(`Lecture des sous-tenants impossible: ${error.message}`);
    return (data ?? []).map(toTenant);
  }

  async getPreferences(userId: UserId) {
    const { data, error } = await this.client
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`Lecture des préférences impossible: ${error.message}`);
    return data === null ? null : toPreferences(data);
  }

  async updatePreferences(userId: UserId, patch: UpdatePreferences) {
    const values: Database['public']['Tables']['user_preferences']['Insert'] = { user_id: userId };
    if (patch.theme !== undefined) values.theme = patch.theme;
    if (patch.language !== undefined) values.language = patch.language;
    if (patch.default_delivery_zone !== undefined) {
      values.default_delivery_zone = patch.default_delivery_zone;
    }
    if (patch.notifications_email !== undefined) {
      values.notifications_email = patch.notifications_email;
    }
    if (patch.plan !== undefined) values.plan = patch.plan;
    if (patch.is_admin !== undefined) values.is_admin = patch.is_admin;
    const { data, error } = await this.client
      .from('user_preferences')
      .upsert(values, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw new Error(`Mise à jour des préférences impossible: ${error.message}`);
    return toPreferences(data);
  }

  async updateLastTenant(userId: UserId, tenantId: string) {
    const { data, error } = await this.client
      .from('user_preferences')
      .upsert({ user_id: userId, last_tenant_id: tenantId }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw new Error(`Mise à jour du tenant courant impossible: ${error.message}`);
    return toPreferences(data);
  }

  async updateTenantSettings(_userId: UserId, tenantId: string, patch: UpdateTenantSettings): Promise<void> {
    const values: Database['public']['Tables']['tenants']['Update'] = {};
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.slug !== undefined) values.slug = patch.slug;
    const { data, error } = await this.client.from('tenants').update(values).eq('id', tenantId).select('id').maybeSingle();
    if (error) throw new SessionTenantMutationError(error.code === '23505' ? 'conflict' : 'permission_denied', error.message);
    if (!data) throw new SessionTenantMutationError('permission_denied', 'Espace introuvable ou modification interdite.');
  }
}

function toTenant(row: TenantRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    parent_tenant_id: row.parent_tenant_id,
    plan: normalizePlan(row.plan),
    is_system_tenant: row.is_system_tenant,
    settings: toRecord(row.settings),
    created_at: row.created_at,
    siren: row.siren,
    siren_data: row.siren_data === null ? null : toRecord(row.siren_data),
    verified: row.verified,
    verified_at: row.verified_at,
    tax_regime: row.tax_regime,
  };
}

function toPreferences(row: PreferencesRow): SessionUserPreferences {
  return {
    theme: row.theme === 'dark' ? 'dark' : 'light',
    language: row.language === 'en' ? 'en' : 'fr',
    default_delivery_zone: row.default_delivery_zone,
    notifications_email: row.notifications_email,
    plan: normalizePlan(row.plan),
    is_admin: row.is_admin,
    last_tenant_id: row.last_tenant_id,
  };
}

function normalizeRole(value: string): DirectMembership['role'] {
  return ['owner', 'admin', 'member', 'partner'].includes(value)
    ? (value as DirectMembership['role'])
    : 'member';
}

function normalizePlan(value: string): 'freemium' | 'pro' | 'enterprise' {
  return value === 'pro' || value === 'enterprise' ? value : 'freemium';
}

function toPermissions(value: unknown): DirectMembership['permissions'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  const candidate = value as Record<string, unknown>;
  return {
    ...(typeof candidate.can_quote === 'boolean' ? { can_quote: candidate.can_quote } : {}),
    ...(typeof candidate.can_order === 'boolean' ? { can_order: candidate.can_order } : {}),
    ...(typeof candidate.can_invite === 'boolean' ? { can_invite: candidate.can_invite } : {}),
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
