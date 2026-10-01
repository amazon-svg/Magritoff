import type {
  ClaimedNotificationMessage,
  NotificationSendRepository,
  NotificationSendSeal,
  NotificationSendSettings,
} from '../../modules/notifications/application/notification-sender.ts';
import type { NotificationChannel } from '../../modules/notifications/api/contracts.ts';
import type {
  DeferredRenderPayload,
  RenderedSegment,
} from '../../modules/notifications/application/notification-tag-renderer.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type ClaimedNotificationMessageRow = Readonly<{
  id: string;
  tenant_id: string;
  channel: string;
  recipient: string | null;
  subject: string | null;
  body: string;
  attempts: number;
  occurrence_count: number;
  deferred_render: unknown;
}>;

/** Accès worker à la file portable des notifications. */
export class PostgresNotificationSendRepository implements NotificationSendRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  async claim(settings: NotificationSendSettings): Promise<readonly ClaimedNotificationMessage[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<ClaimedNotificationMessageRow>(
        'select * from magrit.claim_notification_messages($1,$2,$3)',
        [settings.limit, settings.maxAttempts, settings.maxAgeSeconds],
      );
      return Object.freeze(result.rows
        .filter((row): row is ClaimedNotificationMessageRow & { recipient: string } => row.recipient !== null)
        .map(toClaimedNotificationMessage));
    });
  }

  markSent(id: string, providerMessageId: string | null, seal: NotificationSendSeal | null): Promise<void> {
    return this.updateVerdict(id, 'sent', null, providerMessageId, seal);
  }

  async markRetry(id: string, reason: string): Promise<void> {
    await this.transactions.run({}, async (client) => {
      const result = await client.query(
        `update public.notification_logs
            set last_error=$2
          where id=$1 and status='pending'`,
        [id, reason.slice(0, 2000)],
      );
      assertUpdated(result.rowCount, id);
    });
  }

  markFailed(id: string, reason: string, seal: NotificationSendSeal | null): Promise<void> {
    return this.updateVerdict(id, 'failed', reason, null, seal);
  }

  private async updateVerdict(
    id: string,
    status: 'sent' | 'failed',
    reason: string | null,
    providerMessageId: string | null,
    seal: NotificationSendSeal | null,
  ): Promise<void> {
    await this.transactions.run({}, async (client) => {
      const result = await client.query(
        `update public.notification_logs
            set status=$2,
                sent_at=case when $2='sent' then clock_timestamp() else sent_at end,
                provider_message_id=case when $2='sent' then $3 else provider_message_id end,
                last_error=case when $2='failed' then $4 else null end,
                subject=case when $5::boolean then $6 else subject end,
                body=case when $5::boolean then $7 else body end,
                deferred_render=case when $5::boolean then null else deferred_render end
          where id=$1 and status='pending'`,
        [
          id,
          status,
          providerMessageId,
          reason?.slice(0, 2000) ?? null,
          seal !== null,
          seal?.subject ?? null,
          seal?.body ?? null,
        ],
      );
      assertUpdated(result.rowCount, id);
    });
  }
}

function assertUpdated(rowCount: number | null, id: string): void {
  if (rowCount !== 1) throw new Error(`Notification ${id} absente ou deja traitee.`);
}

function isNotificationChannel(value: string): value is NotificationChannel {
  return value === 'email' || value === 'sms';
}

function isRenderedSegment(value: unknown): value is RenderedSegment {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    (record['kind'] === 'literal' && typeof record['text'] === 'string')
    || (record['kind'] === 'tag' && typeof record['id'] === 'string')
  );
}

function isRenderedSegmentArray(value: unknown): value is readonly RenderedSegment[] {
  return Array.isArray(value) && value.every(isRenderedSegment);
}

function toDeferredRender(value: unknown): DeferredRenderPayload | null {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isRenderedSegmentArray(record['body'])) return null;
  const subject = record['subject'];
  if (subject !== null && subject !== undefined && !isRenderedSegmentArray(subject)) return null;
  return { body: record['body'], subject: subject ?? null };
}

function toClaimedNotificationMessage(
  row: ClaimedNotificationMessageRow & { recipient: string },
): ClaimedNotificationMessage {
  return Object.freeze({
    id: row.id,
    tenantId: row.tenant_id as ClaimedNotificationMessage['tenantId'],
    channel: isNotificationChannel(row.channel) ? row.channel : 'email',
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    attempts: row.attempts,
    occurrenceCount: row.occurrence_count,
    deferredRender: toDeferredRender(row.deferred_render),
  });
}
