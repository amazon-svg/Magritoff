/**
 * Implementation Supabase du port `OutboxDispatchRepository` (E10.10b-3).
 *
 * `client` DOIT etre un client `service_role` — la reclamation delegue a
 * `api_claim_outbox_events` (`security definer`, `grant execute` au SEUL
 * `service_role`, migration 20260908000000) et le verdict (`markDelivered`/
 * `markFailed`) ecrit sur des colonnes dont le `grant update` est, lui aussi,
 * reserve a `service_role`. Un client `anon`/`authenticated` echouerait sur
 * les deux operations — c est voulu, meme raisonnement que
 * `SupabaseOutboxRepository` (E10.0).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClaimedOutboxEvent,
  OutboxDispatchRepository,
  OutboxDispatchSettings,
} from '../../modules/_shared/application/index.ts';
import type { EventNameDto } from '../../modules/_shared/api/index.ts';

/** Ligne rendue par `api_claim_outbox_events` (setof public.outbox_events). */
type ClaimedOutboxEventRow = Readonly<{
  id: string;
  tenant_id: string;
  event_name: string;
  event_version: number;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  delivery_attempts: number;
}>;

export class SupabaseOutboxDispatchRepository implements OutboxDispatchRepository {
  /** @param client Client `service_role` — seul role habilite sur la file et sur la fonction de reclamation. */
  constructor(private readonly client: SupabaseClient<any>) {}

  async claim(settings: OutboxDispatchSettings): Promise<readonly ClaimedOutboxEvent[]> {
    const { data, error } = await this.client.rpc('api_claim_outbox_events', {
      p_limit: settings.limit,
      p_max_attempts: settings.maxAttempts,
      p_max_age: `${settings.maxAgeSeconds} seconds`,
    });
    if (error) {
      throw new Error(`Reclamation de l outbox impossible: ${error.message}`);
    }
    const rows = (data ?? []) as readonly ClaimedOutboxEventRow[];
    return rows.map(toClaimedOutboxEvent);
  }

  async markDelivered(eventId: string): Promise<void> {
    const { error } = await this.client
      .from('outbox_events')
      .update({ published_at: new Date().toISOString() })
      .eq('id', eventId);
    if (error) {
      throw new Error(`Marquage 'livre' de l evenement ${eventId} impossible: ${error.message}`);
    }
  }

  async markFailed(eventId: string, reason: string): Promise<void> {
    const { error } = await this.client
      .from('outbox_events')
      .update({ last_error: reason.slice(0, 2000) })
      .eq('id', eventId);
    if (error) {
      throw new Error(`Enregistrement de l echec de l evenement ${eventId} impossible: ${error.message}`);
    }
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
    occurredAt: row.occurred_at,
    deliveryAttempts: row.delivery_attempts,
  });
}
