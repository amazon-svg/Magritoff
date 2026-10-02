import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PoolClient } from 'pg';
import storageBuckets from '../../../config/storage-buckets.json';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import { CommercialOrderNotFoundError } from '../../modules/commercial-orders/application/commercial-orders-repository.ts';
import type { OrderDocumentDto } from '../../modules/order-documents/api/contracts.ts';
import {
  OrderDocumentAlreadyGeneratedError,
  OrderDocumentGenerationFailedError,
  OrderDocumentTemplateMissingError,
  type OrderDocumentsRepository,
  type StoreOrderDocumentParams,
} from '../../modules/order-documents/application/order-documents-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

const DOWNLOAD_URL_TTL_SECONDS = 300;

type DocumentRow = Record<string, unknown> & {
  order_id: string;
  template_id: string;
  storage_path: string;
};

export class PostgresOrderDocumentsRepository implements OrderDocumentsRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = storageBuckets.order_documents,
  ) {}

  async findByOrderId(tenantId: TenantId, orderId: string): Promise<OrderDocumentDto | null> {
    const row = await this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<DocumentRow>(
        `select order_id, template_id, generated_at, generated_by, generated_by_label,
                byte_size, sha256, content_type, page_count, storage_path
           from public.order_documents
          where tenant_id = $1 and order_id = $2`,
        [tenantId, orderId],
      );
      return result.rows[0] ?? null;
    });
    return row === null ? null : this.toDto(row);
  }

  async store(
    tenantId: TenantId,
    actor: UserId,
    params: StoreOrderDocumentParams,
  ): Promise<OrderDocumentDto> {
    const storagePath = `${tenantId}/${params.orderId}.pdf`;
    let uploaded = false;

    try {
      const row = await this.transactions.run({ tenantId, userId: actor }, async (client) => {
        await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
          `order-document:${tenantId}:${params.orderId}`,
        ]);
        await this.assertCanStore(client, tenantId, params.orderId, params.templateId);

        await this.storage.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: storagePath,
          Body: params.bytes,
          ContentType: 'application/pdf',
          IfNoneMatch: '*',
        }));
        uploaded = true;

        const sha256 = await sha256Hex(params.bytes);
        const result = await client.query<DocumentRow>(
          `insert into public.order_documents (
             tenant_id, order_id, template_id, storage_path, byte_size, sha256,
             content_type, page_count, generated_at, generated_by, generated_by_label
           )
           select $1, $2, $3, $4, $5, $6, 'application/pdf', $7, $8, $9,
                  coalesce(nullif(btrim(display_name), ''), email_normalized)
             from public.app_users
            where id = $9
           returning order_id, template_id, generated_at, generated_by, generated_by_label,
                     byte_size, sha256, content_type, page_count, storage_path`,
          [
            tenantId,
            params.orderId,
            params.templateId,
            storagePath,
            params.bytes.length,
            sha256,
            params.pageCount,
            params.generatedAt,
            actor,
          ],
        );
        if (!result.rows[0]) throw new Error('authentication_required: acteur inconnu');
        return result.rows[0];
      });
      return this.toDto(row);
    } catch (error) {
      if (uploaded) {
        await this.storage
          .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePath }))
          .catch(() => undefined);
      }
      throw mapStoreError(error);
    }
  }

  private async assertCanStore(
    client: PoolClient,
    tenantId: TenantId,
    orderId: string,
    templateId: string,
  ): Promise<void> {
    const existing = await client.query(
      'select 1 from public.order_documents where tenant_id = $1 and order_id = $2',
      [tenantId, orderId],
    );
    if (existing.rowCount !== 0) throw new OrderDocumentAlreadyGeneratedError();

    const order = await client.query(
      'select 1 from public.commercial_orders where tenant_id = $1 and id = $2',
      [tenantId, orderId],
    );
    if (order.rowCount === 0) throw new CommercialOrderNotFoundError();

    const template = await client.query(
      `select 1 from public.document_pdf_templates
        where tenant_id = $1 and id = $2 and document_type = 'order'`,
      [tenantId, templateId],
    );
    if (template.rowCount === 0) throw new OrderDocumentTemplateMissingError();
  }

  private async toDto(row: DocumentRow): Promise<OrderDocumentDto> {
    const url = await getSignedUrl(
      this.storage,
      new GetObjectCommand({ Bucket: this.bucket, Key: row.storage_path }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
    );
    return {
      order_id: row.order_id,
      template_id: row.template_id,
      generated_at: toIsoTimestamp(row['generated_at'] as Date | string),
      generated_by: row['generated_by'] ? String(row['generated_by']) : null,
      generated_by_label: row['generated_by_label'] ? String(row['generated_by_label']) : null,
      byte_size: Number(row['byte_size']),
      sha256: String(row['sha256']),
      content_type: 'application/pdf',
      page_count: Number(row['page_count']),
      download_url: url,
      download_url_expires_at: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function mapStoreError(error: unknown): Error {
  if (
    error instanceof OrderDocumentAlreadyGeneratedError
    || error instanceof OrderDocumentTemplateMissingError
    || error instanceof CommercialOrderNotFoundError
  ) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('duplicate key') || message.includes('order.document_already_generated')) {
    return new OrderDocumentAlreadyGeneratedError(message);
  }
  if (message.includes('order.document_template_missing')) {
    return new OrderDocumentTemplateMissingError(message);
  }
  if (message.includes('order.not_found')) return new CommercialOrderNotFoundError(message);
  return new OrderDocumentGenerationFailedError(`Enregistrement du bon de commande impossible : ${message}`);
}
