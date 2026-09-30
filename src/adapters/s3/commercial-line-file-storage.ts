import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import storageBuckets from '../../../config/storage-buckets.json';
import type { CommercialLineFileObjectStorage } from '../../modules/commercial-line-files/application/commercial-line-files-repository.ts';

export class S3CommercialLineFileStorage implements CommercialLineFileObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket = storageBuckets.commercial_line_files,
  ) {}

  async upload(params: Parameters<CommercialLineFileObjectStorage['upload']>[0]) {
    const storagePath = `${params.tenantId}/${params.fileId}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
      Body: params.bytes,
      ContentType: params.contentType,
      IfNoneMatch: '*',
    }));
    return { storagePath };
  }

  async remove(storagePath: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePath }));
  }

  createReadUrl(params: Parameters<CommercialLineFileObjectStorage['createReadUrl']>[0]): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.storagePath,
      ...(params.download ? {
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(params.filename)}`,
      } : {}),
    }), { expiresIn: params.expiresInSeconds });
  }
}
