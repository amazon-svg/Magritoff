import type { UserId } from '../../kernel/ids/index.ts';
import type { SessionUserPreferences } from '../../modules/session/api/contracts.ts';
import type {
  DirectMembership,
  SessionPreferencesRepository,
} from '../../modules/session/application/session-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type MembershipRow = Readonly<{
  id: string;
  slug: string;
  name: string;
  parent_tenant_id: string | null;
  plan: string;
  is_system_tenant: boolean;
  settings: unknown;
  created_at: Date;
  role: string;
}>;

type PreferencesRow = Readonly<{
  theme: string;
  language: string;
  default_delivery_zone: string;
  notifications_email: boolean;
  plan: string;
  is_admin: boolean;
  last_tenant_id: string | null;
}>;

export class PostgresSessionBootstrapRepository implements SessionPreferencesRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  async autoAcceptPendingInvitations(): Promise<void> {
    // Les invitations seront migrees dans un lot distinct. Aucune acceptation
    // implicite n'est simulee pendant la coexistence.
  }

  listDirectMemberships(userId: UserId): Promise<readonly DirectMembership[]> {
    return this.transactions.run({ userId }, async (client) => {
      const result = await client.query<MembershipRow>(`
        select t.id::text, t.slug, t.name, t.parent_tenant_id::text,
               t.plan, t.is_system_tenant, t.settings, t.created_at, tm.role
        from public.tenant_members tm
        join public.tenants t on t.id = tm.tenant_id
        where tm.user_id = $1
        order by t.name, t.id
      `, [userId]);
      return result.rows.map((row) => ({
        tenant: mapTenant(row),
        role: row.role === 'owner' || row.role === 'admin' ? 'admin' : 'member',
        accessScope: 'magrit_full' as const,
        allowedShopIds: [],
        permissions: {
          can_quote: true,
          can_order: true,
          can_invite: row.role === 'owner' || row.role === 'admin',
        },
      }));
    });
  }

  listChildren(parentTenantIds: readonly string[]) {
    if (parentTenantIds.length === 0) return Promise.resolve([]);
    return this.transactions.run({}, async (client) => {
      const result = await client.query<MembershipRow>(`
        select id::text, slug, name, parent_tenant_id::text, plan,
               is_system_tenant, settings, created_at, 'member'::text as role
        from public.tenants
        where parent_tenant_id = any($1::uuid[])
        order by name, id
      `, [[...parentTenantIds]]);
      return result.rows.map(mapTenant);
    });
  }

  getPreferences(userId: UserId): Promise<Partial<SessionUserPreferences> | null> {
    return this.transactions.run({ userId }, async (client) => {
      const result = await client.query<PreferencesRow>(`
        select theme, language, default_delivery_zone, notifications_email,
               plan, is_admin, last_tenant_id::text
        from public.user_preferences
        where user_id = $1
      `, [userId]);
      const row = result.rows[0];
      return row === undefined ? null : mapPreferences(row);
    });
  }

  updatePreferences(userId: UserId, patch: Parameters<SessionPreferencesRepository['updatePreferences']>[1]) {
    return this.transactions.run({ userId }, async (client) => {
      const result = await client.query<PreferencesRow>(`
        insert into public.user_preferences (
          user_id, theme, language, default_delivery_zone, notifications_email
        ) values (
          $1,
          coalesce($2, 'light'),
          coalesce($3, 'fr'),
          coalesce($4, 'FR-75'),
          coalesce($5, true)
        )
        on conflict (user_id) do update set
          theme = coalesce($2, user_preferences.theme),
          language = coalesce($3, user_preferences.language),
          default_delivery_zone = coalesce($4, user_preferences.default_delivery_zone),
          notifications_email = coalesce($5, user_preferences.notifications_email),
          updated_at = now()
        returning theme, language, default_delivery_zone, notifications_email,
                  plan, is_admin, last_tenant_id::text
      `, [
        userId,
        patch.theme ?? null,
        patch.language ?? null,
        patch.default_delivery_zone ?? null,
        patch.notifications_email ?? null,
      ]);
      return mapPreferences(requiredRow(result.rows));
    });
  }

  updateLastTenant(userId: UserId, tenantId: string) {
    return this.transactions.run({ userId }, async (client) => {
      const result = await client.query<PreferencesRow>(`
        insert into public.user_preferences (user_id, last_tenant_id)
        values ($1, $2)
        on conflict (user_id) do update set
          last_tenant_id = excluded.last_tenant_id,
          updated_at = now()
        returning theme, language, default_delivery_zone, notifications_email,
                  plan, is_admin, last_tenant_id::text
      `, [userId, tenantId]);
      return mapPreferences(requiredRow(result.rows));
    });
  }
}

function mapTenant(row: MembershipRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    parent_tenant_id: row.parent_tenant_id,
    plan: normalizePlan(row.plan),
    is_system_tenant: row.is_system_tenant,
    settings: asRecord(row.settings),
    created_at: row.created_at.toISOString(),
  };
}

function normalizePlan(value: string): 'freemium' | 'pro' | 'enterprise' {
  return value === 'pro' || value === 'enterprise' ? value : 'freemium';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredRow(rows: readonly PreferencesRow[]): PreferencesRow {
  const row = rows[0];
  if (row === undefined) throw new Error('Les preferences mises a jour sont introuvables.');
  return row;
}

function mapPreferences(row: PreferencesRow): SessionUserPreferences {
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
