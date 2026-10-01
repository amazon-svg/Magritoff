import type { TenantId } from '../../kernel/ids/index.ts';
import type {
  PurgeNoticeDeliveryGateway,
  PurgeNoticeDeliveryOutcome,
  PurgeNoticeDeliveryRecord,
  PurgeNoticeRecipient,
  PurgeNoticeRecipientGateway,
} from '../../modules/order-files/application/purge-notice-gateway.ts';
import type {
  ClaimedPurgeNoticeStage,
  ClaimedPurgeNoticeSummary,
  DeliveryPendingCheck,
  ExpiredPurgeNoticeSummary,
  PurgeSweepRepository,
} from '../../modules/order-files/application/purge-sweep-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

export class PostgresOrderFilePurgeSweepRepository implements PurgeSweepRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  claimNotices(
    stage: ClaimedPurgeNoticeStage,
    leadDays: number,
  ): Promise<readonly ClaimedPurgeNoticeSummary[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{
        notice_id: string; tenant_id: TenantId; file_count: number; order_count: number;
      }>('select * from magrit.claim_order_file_purge_notices($1,$2)', [stage, leadDays]);
      return Object.freeze(result.rows.map((row) => Object.freeze({
        noticeId: row.notice_id,
        tenantId: row.tenant_id,
        fileCount: row.file_count,
        orderCount: row.order_count,
      })));
    });
  }

  expireStaleNotices(window: Readonly<{ days: number }>): Promise<readonly ExpiredPurgeNoticeSummary[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{ id: string; tenant_id: TenantId; stage: ClaimedPurgeNoticeStage }>(
        'select * from magrit.expire_order_file_purge_notices($1)',
        [window.days],
      );
      return Object.freeze(result.rows.map((row) => Object.freeze({
        noticeId: row.id,
        tenantId: row.tenant_id,
        stage: row.stage,
      })));
    });
  }

  claimDeliveriesForRecheck(limit: number): Promise<readonly DeliveryPendingCheck[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{
        delivery_id: string; notice_id: string; provider_message_id: string;
      }>('select * from magrit.claim_order_file_purge_deliveries_for_check($1)', [limit]);
      return Object.freeze(result.rows.map((row) => Object.freeze({
        deliveryId: row.delivery_id,
        noticeId: row.notice_id,
        providerMessageId: row.provider_message_id,
      })));
    });
  }

  async recordDeliveryCheck(deliveryId: string, lastStatus: string): Promise<void> {
    await this.transactions.run({}, async (client) => {
      await client.query('select magrit.record_order_file_purge_delivery_check($1,$2)', [deliveryId, lastStatus]);
    });
  }

  async resetStaleNotices(): Promise<number> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{ count: number }>(
        'select magrit.reset_stale_order_file_purge_notices()::int as count',
      );
      return result.rows[0]?.count ?? 0;
    });
  }
}

export class PostgresOrderFilePurgeNoticeGateway
implements PurgeNoticeRecipientGateway, PurgeNoticeDeliveryGateway {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  resolveRecipients(tenantId: TenantId): Promise<readonly PurgeNoticeRecipient[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{ recipient_user_id: string | null; recipient_email: string }>(
        'select * from magrit.resolve_order_file_purge_recipients($1)',
        [tenantId],
      );
      return Object.freeze(result.rows.map((row) => Object.freeze({
        userId: row.recipient_user_id,
        email: row.recipient_email,
      })));
    });
  }

  getTenantSlug(tenantId: TenantId): Promise<string | null> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{ slug: string | null }>(
        'select magrit.order_file_purge_tenant_slug($1) as slug',
        [tenantId],
      );
      return result.rows[0]?.slug ?? null;
    });
  }

  recordDeliveryAttempt(
    noticeId: string,
    recipient: PurgeNoticeRecipient,
    outcome: PurgeNoticeDeliveryOutcome,
  ): Promise<PurgeNoticeDeliveryRecord> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{ id: string; accepted_at: Date | string | null }>(
        `select (delivery).id,(delivery).accepted_at from(
           select magrit.record_order_file_purge_delivery_attempt($1,$2,$3,$4) delivery
         ) recorded`,
        [noticeId, recipient.userId, recipient.email, outcome.providerMessageId],
      );
      const row = result.rows[0];
      if (!row) throw new Error(`Livraison de rappel ${noticeId} non enregistree.`);
      return Object.freeze({ id: row.id, accepted: row.accepted_at !== null });
    });
  }
}
