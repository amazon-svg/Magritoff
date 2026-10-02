import type { Pool } from 'pg';
import type { ReadinessProbe } from '../../server/api/readiness-route.ts';

export class PostgresReadinessProbe implements ReadinessProbe {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async check(): Promise<void> {
    await this.pool.query('select 1');
  }
}
