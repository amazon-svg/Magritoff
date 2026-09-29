/**
 * Adaptateur S3 portable du port metier `OrderExportStorage`.
 *
 * Le chemin reste identique a l implementation Supabase afin de permettre une
 * copie objet pour objet. `IfNoneMatch: '*'` preserve la semantique historique
 * `upsert: false` sans introduire une verification non atomique avant depot.
 */
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import storageBuckets from '../../../config/storage-buckets.json';
import type {
  OrderExportStorage,
  UploadOrderExportFileParams,
} from '../../modules/order-exports/application/order-export-storage.ts';

export class S3OrderExportStorage implements OrderExportStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket = storageBuckets.order_exports,
  ) {}

  async upload(params: UploadOrderExportFileParams): Promise<Readonly<{ storagePath: string }>> {
    const storagePath = `${params.tenantId}/${params.exportId}.${params.extension}`;

    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
        Body: params.bytes,
        ContentType: params.contentType,
        IfNoneMatch: '*',
      }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Depot du fichier d export ${params.exportId} impossible: ${detail}`,
        { cause: error },
      );
    }

    return { storagePath };
  }
}
