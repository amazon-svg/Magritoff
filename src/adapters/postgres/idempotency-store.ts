import type {
  IdempotencyLookup,
  IdempotencyRecord,
  IdempotencyRequest,
  IdempotencyStore,
} from '../../modules/_shared/application/index.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type IdempotencyRow = Readonly<{
  fingerprint: string;
  status: 'in_progress' | 'completed';
  response_status: number | null;
  response_body: unknown;
  response_etag: string | null;
  locked_until: Date;
}>;

/** Stockage durable et atomique des cles Idempotency-Key. */
export class PostgresIdempotencyStore implements IdempotencyStore {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  begin(request: IdempotencyRequest): Promise<IdempotencyLookup> {
    return this.transactions.run({ tenantId: request.tenantId }, async (client) => {
      await client.query(`
        delete from public.api_idempotency_keys
         where tenant_id = $1
           and idempotency_key = $2
           and expires_at <= clock_timestamp()
      `, [request.tenantId, request.key]);

      const inserted = await client.query(`
        insert into public.api_idempotency_keys (
          tenant_id, idempotency_key, fingerprint
        ) values ($1, $2, $3)
        on conflict (tenant_id, idempotency_key) do nothing
        returning 1
      `, [request.tenantId, request.key, request.fingerprint]);
      if (inserted.rowCount === 1) return { outcome: 'fresh' } as const;

      // Une instance morte ne doit pas bloquer la cle pendant toute sa duree
      // de retention. Seule une reprise au contenu identique peut renouveler
      // le bail ; une empreinte differente reste un conflit.
      const reclaimed = await client.query(`
        update public.api_idempotency_keys
           set locked_until = clock_timestamp() + interval '10 minutes'
         where tenant_id = $1
           and idempotency_key = $2
           and fingerprint = $3
           and status = 'in_progress'
           and locked_until <= clock_timestamp()
        returning 1
      `, [request.tenantId, request.key, request.fingerprint]);
      if (reclaimed.rowCount === 1) return { outcome: 'fresh' } as const;

      const selected = await client.query<IdempotencyRow>(`
        select fingerprint, status, response_status, response_body,
               response_etag, locked_until
          from public.api_idempotency_keys
         where tenant_id = $1 and idempotency_key = $2
      `, [request.tenantId, request.key]);
      const row = selected.rows[0];
      if (row === undefined) throw new Error('Reservation idempotente introuvable apres conflit.');
      if (row.fingerprint !== request.fingerprint) return { outcome: 'conflict' };
      if (row.status === 'in_progress') return { outcome: 'in_progress' };
      if (row.response_status === null || row.response_body === null) {
        throw new Error('Reponse idempotente completee mais incomplete.');
      }
      return {
        outcome: 'replayed',
        record: {
          status: row.response_status,
          body: row.response_body,
          etag: row.response_etag,
        },
      };
    });
  }

  complete(request: IdempotencyRequest, record: IdempotencyRecord): Promise<void> {
    return this.transactions.run({ tenantId: request.tenantId }, async (client) => {
      const result = await client.query(`
        update public.api_idempotency_keys
           set status = 'completed',
               response_status = $4,
               response_body = $5::jsonb,
               response_etag = $6,
               completed_at = clock_timestamp()
         where tenant_id = $1
           and idempotency_key = $2
           and fingerprint = $3
           and status = 'in_progress'
      `, [
        request.tenantId,
        request.key,
        request.fingerprint,
        record.status,
        JSON.stringify(record.body),
        record.etag,
      ]);
      if (result.rowCount !== 1) {
        throw new Error('Reservation idempotente absente ou deja finalisee.');
      }
    });
  }

  release(request: IdempotencyRequest): Promise<void> {
    return this.transactions.run({ tenantId: request.tenantId }, async (client) => {
      await client.query(`
        delete from public.api_idempotency_keys
         where tenant_id = $1
           and idempotency_key = $2
           and fingerprint = $3
           and status = 'in_progress'
      `, [request.tenantId, request.key, request.fingerprint]);
    });
  }
}
