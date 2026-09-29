import type { UserId } from '../../kernel/ids/index.ts';
import type { SessionUserPreferences } from '../../modules/session/api/contracts.ts';
import type {
  DirectMembership,
  SessionBootstrapRepository,
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

export class PostgresSessionBootstrapRepository implements SessionBootstrapRepository {
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
      return row === undefined ? null : {
        theme: row.theme === 'dark' ? 'dark' : 'light',
        language: row.language === 'en' ? 'en' : 'fr',
        default_delivery_zone: row.default_delivery_zone,
        notifications_email: row.notifications_email,
        plan: normalizePlan(row.plan),
        is_admin: row.is_admin,
        last_tenant_id: row.last_tenant_id,
      };
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
