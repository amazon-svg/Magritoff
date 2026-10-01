import type { Pool } from 'pg';
import { parseId, type TenantId, type UserId } from '../../kernel/ids/index.ts';

export type ResolvedOidcActor = Readonly<{
  userId: UserId;
  tenantId?: TenantId;
}>;

export interface OidcIdentityDirectory {
  resolve(
    identity: Readonly<{ issuer: string; subject: string }>,
    requestedTenantId?: string,
  ): Promise<ResolvedOidcActor | null>;
}

type IdentityRow = Readonly<{ user_id: string; tenant_id: string | null }>;

/**
 * Annuaire strictement serveur. Une identite active peut etre resolue sans
 * tenant pour les routes d onboarding (`POST /tenants`). Des qu un tenant est
 * demande, une appartenance explicite reste obligatoire.
 */
export class PostgresOidcIdentityDirectory implements OidcIdentityDirectory {
  constructor(private readonly database: Pick<Pool, 'connect'>) {}

  async resolve(
    identity: Readonly<{ issuer: string; subject: string }>,
    requestedTenantId?: string,
  ): Promise<ResolvedOidcActor | null> {
    const tenant = requestedTenantId === undefined ? null : parseUuid(requestedTenantId);
    if (requestedTenantId !== undefined && tenant === null) return null;

    const client = await this.database.connect();
    let rows: IdentityRow[];
    try {
      await client.query('begin read only');
      await client.query('set local role "magrit_api"');
      const result = await client.query<IdentityRow>(`
        select u.id::text as user_id, tm.tenant_id::text as tenant_id
        from public.user_identities i
        join public.app_users u on u.id = i.app_user_id and u.status = 'active'
        left join public.tenant_members tm on tm.user_id = u.id
        where i.issuer = $1
          and i.subject = $2
          and ($3::uuid is null or tm.tenant_id = $3::uuid)
        order by tm.tenant_id
        limit 2
      `, [identity.issuer, identity.subject, tenant]);
      rows = result.rows;
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    if (rows.length === 0) return null;
    const row = rows[0];
    if (row === undefined) return null;
    return Object.freeze({
      userId: parseRequiredId(row.user_id) as UserId,
      // Sans tenant demande, ne jamais choisir arbitrairement parmi plusieurs
      // appartenances. Les routes comme GET /session n'ont besoin que du user.
      ...(row.tenant_id !== null && (requestedTenantId !== undefined || rows.length === 1)
        ? { tenantId: parseRequiredId(row.tenant_id) as TenantId }
        : {}),
    });
  }
}

function parseUuid(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null;
}

function parseRequiredId(value: string): string {
  const parsed = parseId(value);
  if (!parsed.ok) throw new TypeError('Identifiant vide retourne par l annuaire OIDC.');
  return parsed.value;
}
