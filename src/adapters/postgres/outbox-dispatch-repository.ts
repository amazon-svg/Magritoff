import type {
  ClaimedOutboxEvent,
  OutboxDispatchRepository,
  OutboxDispatchSettings,
} from '../../modules/_shared/application/index.ts';
import type { EventNameDto } from '../../modules/_shared/api/index.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type ClaimedOutboxEventRow = Readonly<{
  id: string;
  tenant_id: string;
  event_name: string;
  event_version: number;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  occurred_at: Date | string;
  delivery_attempts: number;
}>;

/** Accès worker à la file portable. Le runner doit porter le rôle `magrit_worker`. */
export class PostgresOutboxDispatchRepository implements OutboxDispatchRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  async claim(settings: OutboxDispatchSettings): Promise<readonly ClaimedOutboxEvent[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<ClaimedOutboxEventRow>(`
        select * from magrit.claim_outbox_events($1,$2,$3)
      `, [settings.limit, settings.maxAttempts, settings.maxAgeSeconds]);
      return Object.freeze(result.rows.map(toClaimedOutboxEvent));
    });
  }

  async markDelivered(eventId: string): Promise<void> {
    await this.updateDelivery(eventId, `
      update public.outbox_events
         set published_at=clock_timestamp(),last_error=null
       where id=$1 and published_at is null
    `, []);
  }

  async markFailed(eventId: string, reason: string): Promise<void> {
    await this.updateDelivery(eventId, `
      update public.outbox_events
         set last_error=$2
       where id=$1 and published_at is null
    `, [reason.slice(0, 2000)]);
  }

  private async updateDelivery(eventId: string, sql: string, values: readonly unknown[]): Promise<void> {
    await this.transactions.run({}, async (client) => {
      const result = await client.query(sql, [eventId, ...values]);
      if (result.rowCount !== 1) {
        throw new Error(`Evenement outbox ${eventId} absent ou deja livre.`);
      }
    });
  }
}

function toClaimedOutboxEvent(row: ClaimedOutboxEventRow): ClaimedOutboxEvent {
  return Object.freeze({
    id: row.id,
    tenantId: row.tenant_id as ClaimedOutboxEvent['tenantId'],
    name: row.event_name as EventNameDto,
    version: row.event_version,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: Object.freeze({ ...row.payload }),
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
    deliveryAttempts: row.delivery_attempts,
  });
}
