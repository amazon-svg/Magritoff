import { createHash, randomBytes } from 'node:crypto';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';
import type { OrderFileUploadTicketDto } from '../../modules/order-files/api/contracts.ts';
import {
  OrderFileAlreadyConfirmedError,
  OrderFileRejectedError,
  OrderFileUploadExpiredError,
  OrderFileUploadMissingError,
} from '../../modules/order-files/application/order-files-repository.ts';
import type {
  ConfirmOrderUploadLinkFileCommand,
  CreateOrderUploadLinkCommand,
  OrderUploadLinkContextDto,
  OrderUploadLinkCreatedDto,
  OrderUploadLinkDto,
} from '../../modules/order-upload-links/api/contracts.ts';
import {
  OrderNotFoundError,
  OrderUploadLinkFileLimitReachedError,
  OrderUploadLinkLimitReachedError,
  OrderUploadLinkNotFoundError,
  type ConfirmOrderUploadLinkFileResult,
  type ListOrderUploadLinksResult,
  type OrderUploadLinksRepository,
  type ResolvedOrderUploadLinkPrincipal,
} from '../../modules/order-upload-links/application/order-upload-links-repository.ts';
import {
  MAX_ORDER_FILE_BYTES,
  ORDER_FILE_CONTENT_TYPES,
  ORDER_FILE_LIVE_LIMIT,
  ORDER_FILES_BUCKET,
  storagePathFor,
} from './order-files-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

const LINK_LIVE_LIMIT = 10;
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const MAX_UNCONFIRMED_AGE_MS = 24 * 60 * 60 * 1000;

type LinkRow = Record<string, unknown> & { id: string; order_id: string };

export class PostgresOrderUploadLinksRepository implements OrderUploadLinksRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = ORDER_FILES_BUCKET,
  ) {}

  resolvePrincipal(token: string): Promise<ResolvedOrderUploadLinkPrincipal | null> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<{ link_id: string; order_id: string; tenant_id: TenantId }>(
        'select * from magrit.resolve_order_upload_link($1)',
        [tokenHash(token)],
      );
      const row = result.rows[0];
      return row ? { linkId: row.link_id, orderId: row.order_id, tenantId: row.tenant_id } : null;
    });
  }

  async create(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: CreateOrderUploadLinkCommand,
  ): Promise<OrderUploadLinkCreatedDto> {
    const token = randomBytes(32).toString('base64url');
    const row = await this.transactions.run({ tenantId, userId: actor }, async (client) => {
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `commercial-order-upload-links:${orderId}`,
      ]);
      const order = await client.query(
        'select 1 from public.commercial_orders where tenant_id = $1 and id = $2',
        [tenantId, orderId],
      );
      if (order.rowCount === 0) throw new OrderNotFoundError();

      const count = await client.query<{ count: number }>(
        `select count(*)::int as count from public.commercial_order_upload_links
          where order_id = $1 and revoked_at is null and expires_at > clock_timestamp()`,
        [orderId],
      );
      if ((count.rows[0]?.count ?? 0) >= LINK_LIVE_LIMIT) throw new OrderUploadLinkLimitReachedError();

      const result = await client.query<LinkRow>(
        `insert into public.commercial_order_upload_links(
           order_id, token_hash, expires_at, max_files, label, created_by, created_by_label
         )
         select $1, $2, clock_timestamp() + make_interval(days => $3), $4,
                nullif(btrim(coalesce($5, '')), ''), $6,
                coalesce(nullif(btrim(display_name), ''), email_normalized)
           from public.app_users where id = $6
         returning ${LINK_COLUMNS}`,
        [orderId, tokenHash(token), command.expires_in_days, command.max_files, command.label ?? null, actor],
      );
      if (!result.rows[0]) throw new Error('authentication_required: acteur inconnu');
      return result.rows[0];
    });
    return { ...toLinkDto(row), token };
  }

  listByOrder(tenantId: TenantId, orderId: string): Promise<ListOrderUploadLinksResult | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const order = await client.query(
        'select 1 from public.commercial_orders where tenant_id = $1 and id = $2',
        [tenantId, orderId],
      );
      if (order.rowCount === 0) return null;
      const result = await client.query<LinkRow>(
        `select ${LINK_COLUMNS} from public.commercial_order_upload_links
          where order_id = $1 and revoked_at is null and expires_at > clock_timestamp()
          order by created_at desc`,
        [orderId],
      );
      return result.rows.map(toLinkDto);
    });
  }

  async revoke(tenantId: TenantId, orderId: string, linkId: string, actor: UserId): Promise<void> {
    const revoked = await this.transactions.run({ tenantId, userId: actor }, async (client) => {
      const result = await client.query(
        `update public.commercial_order_upload_links links
            set revoked_at = clock_timestamp(), revoked_by = $4,
                revoked_by_label = (
                  select coalesce(nullif(btrim(display_name), ''), email_normalized)
                    from public.app_users where id = $4
                )
          where links.id = $3 and links.order_id = $2 and links.revoked_at is null
            and links.expires_at > clock_timestamp()
            and exists(
              select 1 from public.commercial_orders orders
               where orders.id = links.order_id and orders.tenant_id = $1
            )
          returning links.id`,
        [tenantId, orderId, linkId, actor],
      );
      return result.rowCount !== 0;
    });
    if (!revoked) throw new OrderUploadLinkNotFoundError();
  }

  getContext(token: string): Promise<OrderUploadLinkContextDto | null> {
    return this.transactions.run({}, async (client) => {
      const result = await client.query<Record<string, unknown>>(
        'select * from magrit.touch_order_upload_link_context($1)',
        [tokenHash(token)],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        printer_name: String(row['printer_name']),
        order_number: String(row['order_number']),
        label: row['label'] ? String(row['label']) : null,
        expires_at: toIsoTimestamp(row['expires_at'] as Date | string),
        max_files: Number(row['max_files']),
        deposited_count: Number(row['deposited_count']),
        max_byte_size: MAX_ORDER_FILE_BYTES,
        accepted_content_types: [...ORDER_FILE_CONTENT_TYPES],
      };
    });
  }

  async issueFileUploadUrl(token: string): Promise<OrderFileUploadTicketDto> {
    const principal = await this.resolvePrincipal(token);
    if (!principal) throw new OrderUploadLinkNotFoundError();

    const budget = await this.transactions.run({ tenantId: principal.tenantId }, async (client) => {
      const result = await client.query<{ max_files: number; deposited_count: number; file_count: number }>(
        `select links.max_files, links.deposited_count,
                (select count(*)::int from public.commercial_order_files files
                  where files.order_id = links.order_id and files.deleted_at is null) as file_count
           from public.commercial_order_upload_links links
          where links.id = $1 and links.token_hash = $2 and links.revoked_at is null
            and links.expires_at > clock_timestamp()`,
        [principal.linkId, tokenHash(token)],
      );
      return result.rows[0] ?? null;
    });
    if (!budget) throw new OrderUploadLinkNotFoundError();
    if (budget.deposited_count >= budget.max_files || budget.file_count >= ORDER_FILE_LIVE_LIMIT) {
      throw new OrderUploadLinkFileLimitReachedError();
    }

    const fileId = crypto.randomUUID();
    const path = storagePathFor(principal.tenantId, principal.orderId, fileId);
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
      expires_at: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  async confirmFileUpload(
    token: string,
    command: ConfirmOrderUploadLinkFileCommand,
  ): Promise<ConfirmOrderUploadLinkFileResult> {
    const principal = await this.resolvePrincipal(token);
    if (!principal) throw new OrderUploadLinkNotFoundError();
    const path = storagePathFor(principal.tenantId, principal.orderId, command.file_id);
    const metadata = await this.readUploadedObject(path);

    if (metadata.lastModified.getTime() < Date.now() - MAX_UNCONFIRMED_AGE_MS) {
      throw new OrderFileUploadExpiredError();
    }
    if (
      metadata.byteSize < 1
      || metadata.byteSize > MAX_ORDER_FILE_BYTES
      || !ORDER_FILE_CONTENT_TYPES.includes(metadata.contentType)
    ) {
      await this.storage.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: path })).catch(() => undefined);
      throw new OrderFileRejectedError(
        `Objet déposé refusé (taille ${metadata.byteSize} octet(s), type ${metadata.contentType || 'inconnu'}).`,
      );
    }

    try {
      const result = await this.transactions.run({}, async (client) => client.query<Record<string, unknown>>(
        'select * from magrit.confirm_order_upload_link_file($1, $2, $3, $4, $5)',
        [tokenHash(token), command.file_id, command.filename, metadata.contentType, metadata.byteSize],
      ));
      const row = result.rows[0];
      if (!row) throw new OrderUploadLinkNotFoundError();
      return {
        deposit: {
          file_id: String(row['file_id']),
          filename: String(row['filename']),
          content_type: String(row['content_type']),
          byte_size: Number(row['byte_size']),
          deposited_at: toIsoTimestamp(row['deposited_at'] as Date | string),
          deposited_count: Number(row['deposited_count']),
          max_files: Number(row['max_files']),
        },
        tenantId: String(row['tenant_id']) as TenantId,
        uploadLinkId: String(row['upload_link_id']),
        orderId: String(row['order_id']),
        orderNumber: String(row['order_number']),
        customerId: String(row['customer_id']),
      };
    } catch (error) {
      throw mapPublicDepositError(error);
    }
  }

  private async readUploadedObject(
    path: string,
  ): Promise<{ byteSize: number; contentType: string; lastModified: Date }> {
    try {
      const head = await this.storage.send(new HeadObjectCommand({ Bucket: this.bucket, Key: path }));
      if (!head.LastModified) throw new Error('date absente');
      return {
        byteSize: Number(head.ContentLength ?? 0),
        contentType: head.ContentType ?? '',
        lastModified: head.LastModified,
      };
    } catch (error) {
      throw new OrderFileUploadMissingError(
        `Aucun fichier déposé au chemin ${path} (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  }
}

const LINK_COLUMNS = `
  id, order_id, label, expires_at, max_files, deposited_count, use_count,
  first_used_at, last_used_at, created_at, created_by, created_by_label, revoked_at
`;

function toLinkDto(row: LinkRow): OrderUploadLinkDto {
  return {
    id: row.id,
    order_id: row.order_id,
    label: row['label'] ? String(row['label']) : null,
    expires_at: toIsoTimestamp(row['expires_at'] as Date | string),
    max_files: Number(row['max_files']),
    deposited_count: Number(row['deposited_count']),
    use_count: Number(row['use_count']),
    first_used_at: toIsoTimestampOrNull(row['first_used_at'] as Date | string | null),
    last_used_at: toIsoTimestampOrNull(row['last_used_at'] as Date | string | null),
    created_at: toIsoTimestamp(row['created_at'] as Date | string),
    created_by: row['created_by'] ? String(row['created_by']) : null,
    created_by_label: row['created_by_label'] ? String(row['created_by_label']) : null,
  };
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function mapPublicDepositError(error: unknown): Error {
  if (error instanceof OrderUploadLinkNotFoundError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('order_file.already_confirmed') || (error as { code?: string }).code === '23505') {
    return new OrderFileAlreadyConfirmedError(message);
  }
  if (message.includes('upload_link.file_limit_reached')) {
    return new OrderUploadLinkFileLimitReachedError(message);
  }
  return error instanceof Error ? error : new Error(message);
}
