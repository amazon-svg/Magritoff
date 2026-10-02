import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import storageBuckets from '../../../config/storage-buckets.json';
import type { ShopAssetStorage } from '../../modules/shops/application/shops-repository.ts';

const SCHEME = 's3://';

export class S3ShopAssetStorage implements ShopAssetStorage {
  constructor(
    private readonly client: S3Client,
    private readonly publicBaseUrl: string,
  ) {}

  async uploadBrandAsset(shopId: string, upload: Parameters<ShopAssetStorage['uploadBrandAsset']>[1]) {
    const key = `${shopId}/${upload.kind}-${crypto.randomUUID()}.${extension(upload.contentType)}`;
    await this.put(storageBuckets.shop_backgrounds, key, upload.contentType, upload.bytes, false);
    return reference(storageBuckets.shop_backgrounds, key);
  }

  async uploadCustomMockup(shopId: string, upload: Parameters<ShopAssetStorage['uploadCustomMockup']>[1]) {
    const key = `${shopId}/${upload.templateType}-${upload.view}.${extension(upload.contentType)}`;
    await this.put(storageBuckets.shop_product_mockups, key, upload.contentType, upload.bytes, true);
    return reference(storageBuckets.shop_product_mockups, key);
  }

  async removeShopAssets(shopId: string): Promise<void> {
    await Promise.all([
      this.removePrefix(storageBuckets.shop_backgrounds, `${shopId}/`),
      this.removePrefix(storageBuckets.shop_product_mockups, `${shopId}/`),
    ]);
  }

  publicUrl(value: string): string {
    const parsed = parseReference(value);
    if (parsed === null) return value;
    const base = this.publicBaseUrl.replace(/\/$/, '');
    return `${base}/${encodeURIComponent(parsed.bucket)}/${parsed.key.split('/').map(encodeURIComponent).join('/')}`;
  }

  reference(value: string): string {
    if (!value || value.startsWith(SCHEME)) return value;
    try {
      const base = new URL(this.publicBaseUrl.endsWith('/') ? this.publicBaseUrl : `${this.publicBaseUrl}/`);
      const url = new URL(value);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return value;
      const relative = url.pathname.slice(base.pathname.length).replace(/^\//, '').split('/').map(decodeURIComponent);
      const bucket = relative.shift();
      return bucket && relative.length > 0 ? reference(bucket, relative.join('/')) : value;
    } catch { return value; }
  }

  private put(bucket: string, key: string, contentType: string, bytes: ArrayBuffer, upsert: boolean) {
    return this.client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(bytes),
      ContentType: contentType,
      ...(upsert ? {} : { IfNoneMatch: '*' }),
    }));
  }

  private async removePrefix(bucket: string, prefix: string): Promise<void> {
    let continuationToken: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken }),
      }));
      const objects = (page.Contents ?? []).flatMap((item) => item.Key ? [{ Key: item.Key }] : []);
      if (objects.length > 0) await this.client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects } }));
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken !== undefined);
  }
}

function reference(bucket: string, key: string): string { return `${SCHEME}${bucket}/${key}`; }
function parseReference(value: string): { bucket: string; key: string } | null {
  if (!value.startsWith(SCHEME)) return null;
  const separator = value.indexOf('/', SCHEME.length);
  if (separator < 0) return null;
  return { bucket: value.slice(SCHEME.length, separator), key: value.slice(separator + 1) };
}
function extension(contentType: string): string {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/svg+xml') return 'svg';
  return 'png';
}
