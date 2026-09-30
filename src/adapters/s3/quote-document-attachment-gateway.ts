import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import storageBuckets from '../../../config/storage-buckets.json';
import type { TenantId } from '../../kernel/ids/index.ts';
import type {
  QuoteDocumentAttachmentBytes,
  QuoteDocumentAttachmentGateway,
} from '../../modules/commercial-quotes/application/quote-sent-notification-consumer.ts';
import type { PostgresTransactionRunner } from '../postgres/transaction-runner.ts';

export class S3QuoteDocumentAttachmentGateway implements QuoteDocumentAttachmentGateway {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = storageBuckets.quote_documents,
  ) {}

  async findAttachment(tenantId: TenantId, quoteId: string): Promise<QuoteDocumentAttachmentBytes | null> {
    const storagePath = await this.transactions.run({}, async (client) => {
      const result = await client.query<{ outbox_quote_document_path: string | null }>(
        'select magrit.outbox_quote_document_path($1,$2)',
        [tenantId, quoteId],
      );
      return result.rows[0]?.outbox_quote_document_path ?? null;
    });
    if (storagePath === null) return null;

    const object = await this.storage.send(new GetObjectCommand({ Bucket: this.bucket, Key: storagePath }));
    if (object.Body === undefined) throw new Error(`Document de devis S3 absent: ${storagePath}`);
    const bytes = await object.Body.transformToByteArray();
    return Object.freeze({ base64Content: Buffer.from(bytes).toString('base64') });
  }
}
