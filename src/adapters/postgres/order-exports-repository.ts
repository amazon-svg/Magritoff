import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import storageBuckets from '../../../config/storage-buckets.json';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';
import type { OrderExportDto, OrderExportFiltersDto } from '../../modules/order-exports/api/contracts.ts';
import {
  OrderExportPendingLimitReachedError,
  type ListOrderExportsFilters,
  type OrderExportsRepository,
  type RequestOrderExportParams,
} from '../../modules/order-exports/application/order-exports-repository.ts';
import type { OrderExportRawRow } from '../../modules/order-exports/application/order-export-columns.ts';
import type {
  ClaimedOrderExport,
  MarkOrderExportReadyParams,
  OrderExportRowsPage,
  OrderExportRunRepository,
  OrderExportRunSettings,
} from '../../modules/order-exports/application/order-export-run-repository.ts';
import type {
  OrderExportOrphanRepository,
  OrderExportPurgeRepository,
  OrderExportPurgeSummary,
} from '../../modules/order-exports/application/order-export-purge-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

const DOWNLOAD_URL_TTL_SECONDS = 300;

type ExportRow = Record<string, unknown> & {
  id: string;
  tenant_id: TenantId;
  status: string;
  format: ClaimedOrderExport['format'];
  granularity: ClaimedOrderExport['granularity'];
  filters: OrderExportFiltersDto;
  requested_by: string | null;
  requested_at: string | Date;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  expires_at: string | Date | null;
  storage_path: string | null;
  file_name: string | null;
};

const SELECT_COLUMNS = `id,tenant_id,status,format,granularity,filters,layout_version,
  requested_by,requested_by_label,requested_at,started_at,completed_at,row_count,
  storage_path,file_name,byte_size,sha256,content_type,expires_at,attempts,error_code,error_detail`;

export class PostgresOrderExportsRepository implements OrderExportsRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = storageBuckets.order_exports,
  ) {}

  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.transactions.run({ tenantId, userId: actorId }, async (client) => Boolean((
      await client.query<{ allowed: boolean }>('select magrit.actor_has_capability($1,$2) allowed', [
        tenantId,
        capability,
      ])
    ).rows[0]?.allowed));
  }

  list(tenantId: TenantId, actor: UserId, filters: ListOrderExportsFilters): Promise<readonly OrderExportDto[]> {
    return this.transactions.run({ tenantId, userId: actor }, async (client) => {
      const parameters: unknown[] = [tenantId];
      const clauses = ['tenant_id=$1'];
      for (const [column, value] of [
        ['status', filters.status],
        ['format', filters.format],
        ['granularity', filters.granularity],
      ] as const) {
        if (value === null) continue;
        parameters.push(value);
        clauses.push(`${column}=$${parameters.length}`);
      }
      if (filters.cursor !== null) {
        parameters.push(filters.cursor.sort, filters.cursor.id);
        clauses.push(`(requested_at,id)<($${parameters.length - 1}::timestamptz,$${parameters.length}::uuid)`);
      }
      parameters.push(filters.size + 1);
      const result = await client.query<ExportRow>(
        `select ${SELECT_COLUMNS} from public.commercial_order_exports
          where ${clauses.join(' and ')} order by requested_at desc,id desc limit $${parameters.length}`,
        parameters,
      );
      return Promise.all(result.rows.map((row) => this.toDto(row, actor)));
    });
  }

  async request(tenantId: TenantId, actor: UserId, params: RequestOrderExportParams): Promise<OrderExportDto> {
    try {
      const row = await this.transactions.run({ tenantId, userId: actor }, async (client) => {
        const id = (await client.query<{ id: string }>(
          'select magrit.request_order_export($1,$2,$3,$4) id',
          [tenantId, params.format, params.granularity, params.filters],
        )).rows[0]?.id;
        if (!id) throw new Error('order_export.request_missing_id');
        const result = await client.query<ExportRow>(
          `select ${SELECT_COLUMNS} from public.commercial_order_exports where id=$1 and tenant_id=$2`,
          [id, tenantId],
        );
        if (!result.rows[0]) throw new Error('order_export.request_missing_row');
        return result.rows[0];
      });
      return this.toDto(row, actor);
    } catch (error) {
      if (error instanceof Error && error.message.includes('order_export.pending_limit_reached')) {
        throw new OrderExportPendingLimitReachedError();
      }
      throw error;
    }
  }

  async findById(tenantId: TenantId, actor: UserId, exportId: string): Promise<OrderExportDto | null> {
    const row = await this.transactions.run({ tenantId, userId: actor }, async (client) => (
      await client.query<ExportRow>(
        `select ${SELECT_COLUMNS} from public.commercial_order_exports where id=$1 and tenant_id=$2`,
        [exportId, tenantId],
      )
    ).rows[0] ?? null);
    return row === null ? null : this.toDto(row, actor);
  }

  private async toDto(row: ExportRow, actor: UserId): Promise<OrderExportDto> {
    const ownerReady = row.status === 'ready' && row.requested_by === actor && row.storage_path !== null;
    let downloadUrl: string | null = null;
    let downloadUrlExpiresAt: string | null = null;
    if (ownerReady) {
      try {
        downloadUrl = await getSignedUrl(this.storage, new GetObjectCommand({
          Bucket: this.bucket,
          Key: row.storage_path!,
          ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name ?? 'export')}`,
        }), { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
        downloadUrlExpiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString();
      } catch (error) {
        console.error(`[order-exports] signature S3 impossible pour ${row.id}`, error);
      }
    }
    return {
      id: row.id,
      status: row.status as OrderExportDto['status'],
      format: row.format,
      granularity: row.granularity,
      filters: row.filters ?? {},
      layout_version: Number(row.layout_version),
      requested_by: row.requested_by,
      requested_by_label: row.requested_by_label as string | null,
      requested_at: toIsoTimestamp(row.requested_at),
      started_at: toIsoTimestampOrNull(row.started_at),
      completed_at: toIsoTimestampOrNull(row.completed_at),
      row_count: row.row_count === null ? null : Number(row.row_count),
      file_name: row.file_name,
      byte_size: row.byte_size === null ? null : Number(row.byte_size),
      sha256: row.sha256 as string | null,
      content_type: row.content_type as OrderExportDto['content_type'],
      download_url: downloadUrl,
      download_url_expires_at: downloadUrlExpiresAt,
      expires_at: toIsoTimestampOrNull(row.expires_at),
      attempts: Number(row.attempts),
      error_code: row.error_code as string | null,
      error_detail: row.error_detail as string | null,
    };
  }
}

export class PostgresOrderExportRunRepository implements OrderExportRunRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  claim(settings: OrderExportRunSettings): Promise<readonly ClaimedOrderExport[]> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{
        id: string;
        tenant_id: TenantId;
        format: ClaimedOrderExport['format'];
        granularity: ClaimedOrderExport['granularity'];
        filters: OrderExportFiltersDto;
      }>('select * from magrit.claim_order_exports($1,$2,$3)', [
        settings.limit,
        settings.maxAttempts,
        settings.maxAgeSeconds,
      ]);
      return Object.freeze(result.rows.map((row) => Object.freeze({
        id: row.id,
        tenantId: row.tenant_id,
        format: row.format,
        granularity: row.granularity,
        filters: row.filters ?? {},
      })));
    });
  }

  readRows(exportId: string, after: unknown | null, limit: number): Promise<OrderExportRowsPage> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{ cursor: unknown; payload: OrderExportRawRow }>(
        'select * from magrit.read_order_export_rows($1,$2,$3)',
        [exportId, after, limit],
      );
      const last = result.rows.at(-1);
      return Object.freeze({
        rows: Object.freeze(result.rows.map((row) => row.payload)),
        nextAfter: result.rows.length < limit ? null : (last?.cursor ?? null),
      });
    });
  }

  async markReady(id: string, params: MarkOrderExportReadyParams): Promise<void> {
    await this.transactions.run({}, async (client) => {
      await client.query('select magrit.mark_order_export_ready($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
        id,
        params.rowCount,
        params.storagePath,
        params.fileName,
        params.byteSize,
        params.sha256,
        params.contentType,
        params.completedAt,
        params.expiresAt,
      ]);
    });
  }

  async markFailed(id: string, code: string, detail: string, completedAt: string): Promise<void> {
    await this.transactions.run({}, async (client) => {
      await client.query('select magrit.mark_order_export_failed($1,$2,$3,$4)', [id, code, detail, completedAt]);
    });
  }
}

export class PostgresOrderExportPurgeRepository implements OrderExportPurgeRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = storageBuckets.order_exports,
  ) {}

  async purgeExpiredFiles(limit: number): Promise<OrderExportPurgeSummary> {
    const rows = await this.transactions.run({}, async (client) => (
      await client.query<{ export_id: string; tenant_id: string; storage_path: string }>(
        'select * from magrit.claim_order_exports_for_purge($1)',
        [limit],
      )
    ).rows);
    if (rows.length === 0) return { filesMarkedExpired: 0, objectsRemoved: 0 };

    let failed: ReadonlySet<string>;
    try {
      const result = await this.storage.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: rows.map((row) => ({ Key: row.storage_path })), Quiet: false },
      }));
      failed = new Set((result.Errors ?? []).flatMap((error) => error.Key ? [error.Key] : []));
    } catch (error) {
      console.error('[order-exports] retrait S3 des exports expires echoue', error);
      return { filesMarkedExpired: rows.length, objectsRemoved: 0 };
    }
    const confirmable = rows.filter((row) => !failed.has(row.storage_path)).map((row) => row.export_id);
    const confirmed = confirmable.length === 0 ? 0 : await this.transactions.run({}, async (client) => Number((
      await client.query<{ count: number }>(
        'select magrit.confirm_order_export_files_purged($1)::int count',
        [confirmable],
      )
    ).rows[0]?.count ?? 0));
    return { filesMarkedExpired: rows.length, objectsRemoved: confirmed };
  }
}

export class PostgresOrderExportOrphanRepository implements OrderExportOrphanRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = storageBuckets.order_exports,
  ) {}

  async removeOrphanObjects(olderThanHours: number, limit: number): Promise<number> {
    if (limit <= 0) return 0;
    const threshold = Date.now() - Math.max(olderThanHours, 24) * 60 * 60 * 1000;
    const selected: Array<{ path: string; exportId: string | null }> = [];
    let continuationToken: string | undefined;
    do {
      const page = await this.storage.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: Math.min(1000, Math.max(limit * 2, 100)),
        ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken }),
      }));
      const objects = (page.Contents ?? []).filter((object): object is typeof object & { Key: string } => (
        typeof object.Key === 'string' && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(csv|xlsx)$/i.test(object.Key)
      ));
      const states = await this.loadStates(objects.map((object) => object.Key));
      for (const object of objects) {
        const state = states.get(object.Key);
        if (state === undefined) {
          if (object.LastModified !== undefined && object.LastModified.getTime() <= threshold) {
            selected.push({ path: object.Key, exportId: null });
          }
        } else if (state.status === 'expired' && state.purgeAttempts >= 3) {
          selected.push({ path: object.Key, exportId: state.exportId });
        }
        if (selected.length >= limit) break;
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (selected.length < limit && continuationToken !== undefined);
    if (selected.length === 0) return 0;

    let failed: ReadonlySet<string>;
    try {
      const result = await this.storage.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: selected.map((object) => ({ Key: object.path })), Quiet: false },
      }));
      failed = new Set((result.Errors ?? []).flatMap((error) => error.Key ? [error.Key] : []));
    } catch (error) {
      console.error('[order-exports] retrait S3 des objets orphelins echoue', error);
      return 0;
    }
    const removed = selected.filter((object) => !failed.has(object.path));
    const confirmable = removed.flatMap((object) => object.exportId === null ? [] : [object.exportId]);
    if (confirmable.length > 0) {
      await this.transactions.run({}, async (client) => {
        await client.query('select magrit.confirm_order_export_files_purged($1)', [confirmable]);
      }).catch((error) => console.error('[order-exports] confirmation des orphelins retires echouee', error));
    }
    return removed.length;
  }

  private loadStates(paths: readonly string[]): Promise<Map<string, Readonly<{
    exportId: string;
    status: string;
    purgeAttempts: number;
  }>>> {
    if (paths.length === 0) return Promise.resolve(new Map());
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{
        storage_path: string;
        export_id: string;
        status: string;
        purge_attempts: number;
      }>('select * from magrit.order_export_object_states($1)', [paths]);
      return new Map(result.rows.map((row) => [row.storage_path, Object.freeze({
        exportId: row.export_id,
        status: row.status,
        purgeAttempts: row.purge_attempts,
      })]));
    });
  }
}
