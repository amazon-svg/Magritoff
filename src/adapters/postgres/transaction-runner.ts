import { authenticatedPostgresRequest } from './authenticated-request-context.ts';
import type { Pool, PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';

export type PostgresRequestContext = Readonly<{
  userId?: UserId;
  tenantId?: TenantId;
  /** Identité technique déjà authentifiée par la façade HTTP. */
  actorKind?: 'service';
}>;

/**
 * Execute une operation dans une transaction portant le contexte RLS Magrit.
 * `set_config(..., true)` garantit que les valeurs disparaissent au COMMIT ou
 * ROLLBACK avant que la connexion ne retourne dans le pool.
 */
export class PostgresTransactionRunner {
  private readonly role: string | null;

  constructor(private readonly pool: Pick<Pool, 'connect'>, role?: string) {
    if (role !== undefined && !/^[a-z_][a-z0-9_]*$/.test(role)) {
      throw new Error('Role PostgreSQL invalide.');
    }
    this.role = role ?? null;
  }

  async run<T>(
    context: PostgresRequestContext,
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const request = authenticatedPostgresRequest();
    // Inherit only for this authenticated tenant, never for workers, storefront
    // transactions, explicit identities, service actors or another tenant.
    const userId = context.userId ?? (context.actorKind === undefined && context.tenantId !== undefined && context.tenantId === request?.tenantId ? request.userId : undefined);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (this.role !== null) await client.query(`set local role "${this.role}"`);
      await client.query(
        `select
           set_config('magrit.user_id', $1, true),
           set_config('magrit.tenant_id', $2, true),
           set_config('magrit.actor_kind', $3, true)`,
        [userId ?? '', context.tenantId ?? '', context.actorKind ?? ''],
      );
      const result = await operation(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}
