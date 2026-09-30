import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PoolClient } from 'pg';
import storageBuckets from '../../../config/storage-buckets.json';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type {
  QuoteDocumentDto,
  QuoteDocumentPreviewDto,
} from '../../modules/quote-documents/api/contracts.ts';
import type {
  QuoteDocumentsRepository,
  StoreQuoteDocumentParams,
} from '../../modules/quote-documents/application/quote-documents-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

const DOWNLOAD_URL_TTL_SECONDS = 300;

type DocumentRow = Record<string, unknown> & {
  quote_id: string;
  template_id: string;
  storage_path: string;
};

/**
 * Acces portail optionnel. Il restera absent tant que les comptes et sessions
 * boutique ne sont pas portes par la baseline PostgreSQL ; dans cet etat la
 * lecture est fermee (404), jamais deleguee silencieusement a Supabase.
 */
export interface StorefrontQuoteDocumentReader {
  findForSession(sessionToken: string, quoteId: string): Promise<QuoteDocumentDto | null>;
}

export class PostgresQuoteDocumentsRepository implements QuoteDocumentsRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = storageBuckets.quote_documents,
    private readonly storefront: StorefrontQuoteDocumentReader | null = null,
  ) {}

  async findByQuoteId(tenantId: TenantId, quoteId: string): Promise<QuoteDocumentDto | null> {
    const row = await this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<DocumentRow>(`
        select quote_id,template_id,generated_at,byte_size,sha256,content_type,page_count,storage_path
          from public.quote_documents where tenant_id=$1 and quote_id=$2
      `, [tenantId, quoteId]);
      return result.rows[0] ?? null;
    });
    return row === null ? null : this.toDto(row);
  }

  findForStorefrontSession(sessionToken: string, quoteId: string): Promise<QuoteDocumentDto | null> {
    if (this.storefront === null) return Promise.resolve(null);
    return this.storefront.findForSession(sessionToken, quoteId);
  }

  async store(
    tenantId: TenantId,
    actor: UserId,
    params: StoreQuoteDocumentParams,
  ): Promise<QuoteDocumentDto> {
    const storagePath = finalStoragePath(tenantId, params.quoteId);
    let uploaded = false;
    try {
      const row = await this.transactions.run({ tenantId, userId: actor }, async (client) => {
        await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [
          `quote-document:${tenantId}:${params.quoteId}`,
        ]);
        await this.assertNotStored(client, tenantId, params.quoteId);
        await this.storage.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: storagePath,
          Body: params.bytes,
          ContentType: 'application/pdf',
          IfNoneMatch: '*',
        }));
        uploaded = true;
        const sha256 = await sha256Hex(params.bytes);
        const result = await client.query<DocumentRow>(`
          insert into public.quote_documents (
            tenant_id,quote_id,template_id,storage_path,byte_size,sha256,
            content_type,page_count,generated_at,generated_by
          ) values ($1,$2,$3,$4,$5,$6,'application/pdf',$7,$8,$9)
          returning quote_id,template_id,generated_at,byte_size,sha256,content_type,page_count,storage_path
        `, [tenantId, params.quoteId, params.templateId, storagePath, params.bytes.length,
          sha256, params.pageCount, params.generatedAt, actor]);
        return required(result.rows[0]);
      });
      return this.toDto(row);
    } catch (error) {
      if (uploaded) {
        await this.storage.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePath })).catch(() => undefined);
      }
      throw error;
    }
  }

  async storePreview(
    tenantId: TenantId,
    params: StoreQuoteDocumentParams,
  ): Promise<QuoteDocumentPreviewDto> {
    const storagePath = previewStoragePath(tenantId, params.quoteId);
    await this.storage.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
      Body: params.bytes,
      ContentType: 'application/pdf',
    }));
    const signed = await this.signedDownloadUrl(storagePath);
    return {
      quote_id: params.quoteId,
      template_id: params.templateId,
      generated_at: params.generatedAt,
      byte_size: params.bytes.length,
      content_type: 'application/pdf',
      page_count: params.pageCount,
      watermark: 'DRAFT',
      download_url: signed.url,
      download_url_expires_at: signed.expiresAt,
    };
  }

  private async assertNotStored(client: PoolClient, tenantId: TenantId, quoteId: string): Promise<void> {
    const existing = await client.query(
      'select 1 from public.quote_documents where tenant_id=$1 and quote_id=$2',
      [tenantId, quoteId],
    );
    if (existing.rowCount !== 0) throw new Error('Un document definitif existe deja pour ce devis.');
  }

  private async toDto(row: DocumentRow): Promise<QuoteDocumentDto> {
    const signed = await this.signedDownloadUrl(row.storage_path);
    return {
      quote_id: row.quote_id,
      template_id: row.template_id,
      generated_at: toIsoTimestamp(row['generated_at'] as Date | string),
      byte_size: Number(row['byte_size']),
      sha256: String(row['sha256']),
      content_type: 'application/pdf',
      page_count: Number(row['page_count']),
      download_url: signed.url,
      download_url_expires_at: signed.expiresAt,
    };
  }

  private async signedDownloadUrl(storagePath: string): Promise<{ url: string; expiresAt: string }> {
    const url = await getSignedUrl(this.storage, new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    }), { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
    return {
      url,
      expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }
}

function finalStoragePath(tenantId: TenantId, quoteId: string): string {
  return `${tenantId}/${quoteId}.pdf`;
}

function previewStoragePath(tenantId: TenantId, quoteId: string): string {
  return `${tenantId}/previews/${quoteId}.pdf`;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Ligne PostgreSQL absente.');
  return value;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
