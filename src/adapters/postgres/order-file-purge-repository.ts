import { DeleteObjectsCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
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
import type {
  BlockedPurgeCount,
  BlockedPurgeReason,
  PurgeExecutionRepository,
  PurgeExecutionSummary,
} from '../../modules/order-files/application/purge-execution-repository.ts';
import type { OrphanObjectRepository } from '../../modules/order-files/application/orphan-object-repository.ts';
import { ORDER_FILES_BUCKET, storagePathFor } from './order-files-repository.ts';

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

export class PostgresOrderFilePurgeExecutionRepository implements PurgeExecutionRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = ORDER_FILES_BUCKET,
  ) {}

  async purgeEligibleFiles(limit: number): Promise<readonly PurgeExecutionSummary[]> {
    const rows = await this.transactions.run({}, async (client) => (
      await client.query<{
        file_id: string;
        order_id: string;
        tenant_id: TenantId;
        byte_size: number | string;
      }>('select * from magrit.claim_order_files_for_purge($1)', [limit])
    ).rows);
    if (rows.length === 0) return [];

    const paths = rows.map((row) => storagePathFor(row.tenant_id, row.order_id, row.file_id));
    try {
      await this.storage.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: paths.map((Key) => ({ Key })), Quiet: true },
      }));
    } catch (error) {
      console.error('[order-file-purge] retrait S3 des fichiers marques echoue', error);
    }

    const grouped = new Map<string, { orderIds: Set<string>; byteSizeFreed: number; fileCount: number }>();
    for (const row of rows) {
      const entry = grouped.get(row.tenant_id) ?? { orderIds: new Set(), byteSizeFreed: 0, fileCount: 0 };
      entry.orderIds.add(row.order_id);
      entry.byteSizeFreed += Number(row.byte_size);
      entry.fileCount += 1;
      grouped.set(row.tenant_id, entry);
    }
    const summaries: PurgeExecutionSummary[] = [];
    for (const [tenantId, entry] of grouped) {
      const orderIds = [...entry.orderIds].slice(0, 50);
      try {
        await this.transactions.run({}, async (client) => {
          await client.query('select magrit.record_order_files_purged($1,$2,$3,$4,$5)', [
            tenantId,
            entry.fileCount,
            entry.orderIds.size,
            entry.byteSizeFreed,
            orderIds,
          ]);
        });
        summaries.push(Object.freeze({
          tenantId,
          fileCount: entry.fileCount,
          orderCount: entry.orderIds.size,
          byteSizeFreed: entry.byteSizeFreed,
          orderIds: Object.freeze(orderIds),
        }));
      } catch (error) {
        console.error(`[order-file-purge] evenement de purge manquant pour ${tenantId}`, error);
      }
    }
    return Object.freeze(summaries);
  }

  countBlockedFiles(): Promise<readonly BlockedPurgeCount[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{ tenant_id: string; reason: string; count: number }>(
        'select * from magrit.count_blocked_order_file_purges()',
      );
      return Object.freeze(result.rows.map((row) => Object.freeze({
        tenantId: row.tenant_id,
        reason: row.reason as BlockedPurgeReason,
        count: row.count,
      })));
    });
  }
}

export class PostgresOrphanOrderFileObjectRepository implements OrphanObjectRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = ORDER_FILES_BUCKET,
  ) {}

  async removeOrphanObjects(olderThanHours: number, limit: number): Promise<number> {
    if (limit <= 0) return 0;
    const threshold = Date.now() - Math.max(olderThanHours, 24) * 60 * 60 * 1000;
    const selected: string[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await this.storage.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: Math.min(1000, Math.max(limit * 2, 100)),
        ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken }),
      }));
      const objects = (page.Contents ?? []).flatMap((object) => {
        const parsed = object.Key ? parseOrderFilePath(object.Key) : null;
        return parsed === null ? [] : [{
          ...parsed,
          key: object.Key!,
          lastModified: object.LastModified ?? null,
        }];
      });
      const states = await this.loadStates(objects.map((object) => object.fileId));
      for (const object of objects) {
        const state = states.get(object.fileId);
        const belongsToRow = state?.tenantId === object.tenantId && state.orderId === object.orderId;
        if ((!belongsToRow && object.lastModified !== null && object.lastModified.getTime() <= threshold)
          || (belongsToRow && state.deleted)) {
          selected.push(object.key);
          if (selected.length >= limit) break;
        }
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (selected.length < limit && continuationToken !== undefined);
    if (selected.length === 0) return 0;

    const removed = await this.storage.send(new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: { Objects: selected.map((Key) => ({ Key })), Quiet: false },
    }));
    const failed = new Set((removed.Errors ?? []).map((error) => error.Key).filter((key): key is string => Boolean(key)));
    return selected.filter((key) => !failed.has(key)).length;
  }

  private loadStates(fileIds: readonly string[]): Promise<Map<string, Readonly<{
    tenantId: string;
    orderId: string;
    deleted: boolean;
  }>>> {
    if (fileIds.length === 0) return Promise.resolve(new Map());
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{
        file_id: string;
        order_id: string;
        tenant_id: string;
        deleted_at: Date | null;
      }>(
        'select * from magrit.order_file_orphan_states($1)',
        [fileIds],
      );
      return new Map(result.rows.map((row) => [row.file_id, {
        tenantId: row.tenant_id,
        orderId: row.order_id,
        deleted: row.deleted_at !== null,
      }]));
    });
  }
}

function parseOrderFilePath(path: string): { tenantId: string; orderId: string; fileId: string } | null {
  const match = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})$/i.exec(path);
  return match ? { tenantId: match[1]!,orderId: match[2]!,fileId: match[3]! } : null;
}
