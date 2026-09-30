import type { OutboxEvent, OutboxRepository } from '../../modules/_shared/application/index.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  async append(events: readonly OutboxEvent[]): Promise<void> {
    if (events.length === 0) return;
    const byTenant = new Map<string, OutboxEvent[]>();
    for (const event of events) {
      const group = byTenant.get(event.tenantId) ?? [];
      group.push(event);
      byTenant.set(event.tenantId, group);
    }

    for (const [tenantId, tenantEvents] of byTenant) {
      await this.transactions.run({ tenantId: tenantId as OutboxEvent['tenantId'] }, async (client) => {
        const values: unknown[] = [];
        const rows = tenantEvents.map((event) => {
          const offset = values.length;
          values.push(
            event.id,
            event.tenantId,
            event.name,
            event.version,
            event.aggregateType,
            event.aggregateId,
            JSON.stringify(event.payload),
            event.occurredAt,
          );
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, `
            + `$${offset + 5}, $${offset + 6}, $${offset + 7}::jsonb, $${offset + 8})`;
        });
        await client.query(`
          insert into public.outbox_events (
            id, tenant_id, event_name, event_version, aggregate_type,
            aggregate_id, payload, occurred_at
          ) values ${rows.join(', ')}
        `, values);
      });
    }
  }
}
