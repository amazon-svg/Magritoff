import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import storageBuckets from '../../../config/storage-buckets.json';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type {
  ConfirmOrderFileUploadCommand,
  OrderFileDetailDto,
  OrderFileDto,
  OrderFileUploadTicketDto,
  UpdateOrderFileCommand,
} from '../../modules/order-files/api/contracts.ts';
import {
  OrderFileAlreadyConfirmedError,
  OrderFileLimitReachedError,
  OrderFileLineNotFoundError,
  OrderFileNotFoundError,
  OrderFileRejectedError,
  OrderFileUploadExpiredError,
  OrderFileUploadMissingError,
  OrderNotFoundError,
  type ListOrderFilesResult,
  type OrderFilesRepository,
} from '../../modules/order-files/application/order-files-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

export const ORDER_FILES_BUCKET = storageBuckets.commercial_order_files;
export const MAX_ORDER_FILE_BYTES = 50 * 1024 * 1024;
export const ORDER_FILE_LIVE_LIMIT = 30;
export const ORDER_FILE_CONTENT_TYPES: readonly string[] = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/zip',
  'application/x-zip-compressed',
]);

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
const MAX_UNCONFIRMED_AGE_MS = 24 * 60 * 60 * 1000;

type FileRow = Record<string, unknown> & { id: string; order_id: string; filename: string };

export class PostgresOrderFilesRepository implements OrderFilesRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = ORDER_FILES_BUCKET,
  ) {}

  listByOrder(tenantId: TenantId, orderId: string): Promise<ListOrderFilesResult | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      if (!(await orderExists(client, tenantId, orderId))) return null;
      const result = await client.query<FileRow>(
        `select ${FILE_COLUMNS}
           from public.commercial_order_files
          where order_id = $1 and deleted_at is null
          order by deposited_at desc`,
        [orderId],
      );
      return result.rows.map(toFileDto);
    });
  }

  async findById(tenantId: TenantId, orderId: string, fileId: string): Promise<OrderFileDetailDto | null> {
    const row = await this.findRow(tenantId, orderId, fileId);
    if (!row) return null;
    const storagePath = storagePathFor(tenantId, orderId, fileId);
    const downloadUrl = await getSignedUrl(
      this.storage,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
      }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
    );
    return {
      ...toFileDto(row),
      download_url: downloadUrl,
      download_url_expires_at: expiresAt(DOWNLOAD_URL_TTL_SECONDS),
    };
  }

  async findRawById(tenantId: TenantId, orderId: string, fileId: string): Promise<OrderFileDto | null> {
    const row = await this.findRow(tenantId, orderId, fileId);
    return row ? toFileDto(row) : null;
  }

  async issueUploadUrl(tenantId: TenantId, orderId: string): Promise<OrderFileUploadTicketDto> {
    const canIssue = await this.transactions.run({ tenantId }, async (client) => {
      if (!(await orderExists(client, tenantId, orderId))) throw new OrderNotFoundError();
      const count = await client.query<{ count: number }>(
        `select count(*)::int as count
           from public.commercial_order_files
          where order_id = $1 and deleted_at is null`,
        [orderId],
      );
      return count.rows[0]?.count ?? 0;
    });
    if (canIssue >= ORDER_FILE_LIVE_LIMIT) throw new OrderFileLimitReachedError();

    const fileId = crypto.randomUUID();
    const path = storagePathFor(tenantId, orderId, fileId);
    const url = await getSignedUrl(
      this.storage,
      new PutObjectCommand({ Bucket: this.bucket, Key: path, IfNoneMatch: '*' }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
    return {
      file_id: fileId,
      url,
      token: fileId,
      path,
      max_byte_size: MAX_ORDER_FILE_BYTES,
      accepted_content_types: [...ORDER_FILE_CONTENT_TYPES],
      expires_at: expiresAt(UPLOAD_URL_TTL_SECONDS),
    };
  }

  async confirmUpload(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: ConfirmOrderFileUploadCommand,
  ): Promise<OrderFileDto> {
    const storagePath = storagePathFor(tenantId, orderId, command.file_id);
    const metadata = await this.readUploadedObject(storagePath);
    if (metadata.lastModified.getTime() < Date.now() - MAX_UNCONFIRMED_AGE_MS) {
      throw new OrderFileUploadExpiredError();
    }
    if (
      metadata.byteSize < 1
      || metadata.byteSize > MAX_ORDER_FILE_BYTES
      || !ORDER_FILE_CONTENT_TYPES.includes(metadata.contentType)
      || /[\u0000-\u001f\u007f]/.test(command.filename)
    ) {
      await this.storage.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePath })).catch(() => undefined);
      throw new OrderFileRejectedError(
        `Objet déposé refusé (taille ${metadata.byteSize} octet(s), type ${metadata.contentType || 'inconnu'}).`,
      );
    }

    try {
      const row = await this.transactions.run({ tenantId, userId: actor }, async (client) => {
        await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
          `commercial-order-files:${orderId}`,
        ]);
        if (!(await orderExists(client, tenantId, orderId))) throw new OrderNotFoundError();

        const alreadyConfirmed = await client.query(
          'select 1 from public.commercial_order_files where id = $1',
          [command.file_id],
        );
        if (alreadyConfirmed.rowCount !== 0) throw new OrderFileAlreadyConfirmedError();

        const liveCount = await client.query<{ count: number }>(
          `select count(*)::int as count from public.commercial_order_files
            where order_id = $1 and deleted_at is null`,
          [orderId],
        );
        if ((liveCount.rows[0]?.count ?? 0) >= ORDER_FILE_LIVE_LIMIT) {
          throw new OrderFileLimitReachedError();
        }

        if (command.order_line_id) {
          const line = await client.query(
            'select 1 from public.commercial_order_lines where order_id = $1 and id = $2',
            [orderId, command.order_line_id],
          );
          if (line.rowCount === 0) throw new OrderFileLineNotFoundError();
        }

        const result = await client.query<FileRow>(
          `insert into public.commercial_order_files(
             id, order_id, order_line_id, filename, content_type, byte_size,
             visibility, storage_path, deposited_by, deposited_by_label
           )
           select $1, $2, $3, $4, $5, $6, $7, $8, $9,
                  coalesce(nullif(btrim(display_name), ''), email_normalized)
             from public.app_users where id = $9
           returning ${FILE_COLUMNS}`,
          [
            command.file_id,
            orderId,
            command.order_line_id ?? null,
            command.filename,
            metadata.contentType,
            metadata.byteSize,
            command.visibility ?? 'internal',
            storagePath,
            actor,
          ],
        );
        if (!result.rows[0]) throw new Error('authentication_required: acteur inconnu');
        return result.rows[0];
      });
      return toFileDto(row);
    } catch (error) {
      throw mapWriteError(error);
    }
  }

  async updateVisibility(
    tenantId: TenantId,
    orderId: string,
    fileId: string,
    actor: UserId,
    command: UpdateOrderFileCommand,
  ): Promise<OrderFileDto> {
    const row = await this.transactions.run({ tenantId, userId: actor }, async (client) => {
      const result = await client.query<FileRow>(
        `update public.commercial_order_files files
            set visibility = $4
          where files.id = $3 and files.order_id = $2 and files.deleted_at is null
            and exists(
              select 1 from public.commercial_orders orders
               where orders.id = files.order_id and orders.tenant_id = $1
            )
          returning ${FILE_COLUMNS}`,
        [tenantId, orderId, fileId, command.visibility],
      );
      return result.rows[0] ?? null;
    });
    if (!row) throw new OrderFileNotFoundError();
    return toFileDto(row);
  }

  async remove(tenantId: TenantId, orderId: string, fileId: string, actor: UserId): Promise<void> {
    const removed = await this.transactions.run({ tenantId, userId: actor }, async (client) => {
      const result = await client.query(
        `update public.commercial_order_files files
            set deleted_at = clock_timestamp(), deleted_by = $4,
                deleted_by_label = (
                  select coalesce(nullif(btrim(display_name), ''), email_normalized)
                    from public.app_users where id = $4
                )
          where files.id = $3 and files.order_id = $2 and files.deleted_at is null
            and exists(
              select 1 from public.commercial_orders orders
               where orders.id = files.order_id and orders.tenant_id = $1
            )
          returning files.id`,
        [tenantId, orderId, fileId, actor],
      );
      return result.rowCount !== 0;
    });
    if (!removed) throw new OrderFileNotFoundError();

    const storagePath = storagePathFor(tenantId, orderId, fileId);
    await this.storage
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePath }))
      .catch((error) => console.error('[order-files] retrait S3 impossible après suppression logique', error));
  }

  private findRow(tenantId: TenantId, orderId: string, fileId: string): Promise<FileRow | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      if (!(await orderExists(client, tenantId, orderId))) return null;
      const result = await client.query<FileRow>(
        `select ${FILE_COLUMNS} from public.commercial_order_files
          where order_id = $1 and id = $2 and deleted_at is null`,
        [orderId, fileId],
      );
      return result.rows[0] ?? null;
    });
  }

  private async readUploadedObject(
    storagePath: string,
  ): Promise<{ byteSize: number; contentType: string; lastModified: Date }> {
    try {
      const head = await this.storage.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storagePath }));
      if (!head.LastModified) throw new Error('date absente');
      return {
        byteSize: Number(head.ContentLength ?? 0),
        contentType: head.ContentType ?? '',
        lastModified: head.LastModified,
      };
    } catch (error) {
      throw new OrderFileUploadMissingError(
        `Aucun fichier déposé au chemin ${storagePath} (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  }
}

const FILE_COLUMNS = `
  id, order_id, order_line_id, filename, content_type, byte_size, visibility,
  deposited_by, deposited_by_label, deposited_via, deposited_at, purge_at, updated_at
`;

export function storagePathFor(tenantId: TenantId, orderId: string, fileId: string): string {
  return `${tenantId}/${orderId}/${fileId}`;
}

function toFileDto(row: FileRow): OrderFileDto {
  return {
    id: row.id,
    order_id: row.order_id,
    order_line_id: row['order_line_id'] ? String(row['order_line_id']) : null,
    filename: row.filename,
    content_type: String(row['content_type']),
    byte_size: Number(row['byte_size']),
    visibility: row['visibility'] as OrderFileDto['visibility'],
    deposited_at: toIsoTimestamp(row['deposited_at'] as Date | string),
    deposited_by: row['deposited_by'] ? String(row['deposited_by']) : null,
    deposited_by_label: row['deposited_by_label'] ? String(row['deposited_by_label']) : null,
    deposited_via: (row['deposited_via'] ?? 'workspace') as OrderFileDto['deposited_via'],
    purge_at: toIsoTimestamp(row['purge_at'] as Date | string),
    updated_at: toIsoTimestamp(row['updated_at'] as Date | string),
  };
}

async function orderExists(
  client: { query: (text: string, values?: readonly unknown[]) => Promise<{ rowCount: number | null }> },
  tenantId: TenantId,
  orderId: string,
): Promise<boolean> {
  const result = await client.query(
    'select 1 from public.commercial_orders where tenant_id = $1 and id = $2',
    [tenantId, orderId],
  );
  return result.rowCount !== 0;
}

function expiresAt(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function mapWriteError(error: unknown): Error {
  if (
    error instanceof OrderNotFoundError
    || error instanceof OrderFileAlreadyConfirmedError
    || error instanceof OrderFileLimitReachedError
    || error instanceof OrderFileLineNotFoundError
  ) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('duplicate key')) return new OrderFileAlreadyConfirmedError(message);
  if (message.includes('commercial_order_files_line_fk')) return new OrderFileLineNotFoundError(message);
  return error instanceof Error ? error : new Error(message);
}
