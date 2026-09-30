import { DeleteObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import storageBuckets from '../../../config/storage-buckets.json';
import type {
  ProjectCommercialFileStorage,
  ProjectCommercialFileUpload,
} from '../../modules/projects/application/projects-repository.ts';

export class S3ProjectCommercialFileStorage implements ProjectCommercialFileStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket = storageBuckets.commercial_line_files,
  ) {}

  async upload(file: ProjectCommercialFileUpload): Promise<Readonly<{ storagePath: string }>> {
    const storagePath = `${file.tenantId}/${file.fileId}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
      Body: file.bytes,
      ContentType: file.contentType,
      IfNoneMatch: '*',
    }));
    return { storagePath };
  }

  async remove(storagePath: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
    }));
  }
}
