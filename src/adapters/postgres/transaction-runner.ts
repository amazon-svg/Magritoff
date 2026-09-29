import type { Pool, PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';

export type PostgresRequestContext = Readonly<{
  userId?: UserId;
  tenantId?: TenantId;
}>;

/**
 * Execute une operation dans une transaction portant le contexte RLS Magrit.
 * `set_config(..., true)` garantit que les valeurs disparaissent au COMMIT ou
 * ROLLBACK avant que la connexion ne retourne dans le pool.
 */
export class PostgresTransactionRunner {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async run<T>(
    context: PostgresRequestContext,
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `select
           set_config('magrit.user_id', $1, true),
           set_config('magrit.tenant_id', $2, true)`,
        [context.userId ?? '', context.tenantId ?? ''],
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
