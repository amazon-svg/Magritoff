import { randomUUID } from 'node:crypto';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { afterAll, describe, expect, it } from 'vitest';
import storageBuckets from '../../config/storage-buckets.json';
import { createS3Client } from '../../src/adapters/s3/client.ts';
import { S3ShopAssetStorage } from '../../src/adapters/s3/shop-asset-storage.ts';

const enabled = process.env['MAGRIT_S3_INTEGRATION'] === '1';
const describeIntegration = enabled ? describe : describe.skip;

describeIntegration('S3ShopAssetStorage — S3 reel', () => {
  const client = createS3Client();
  const storage = new S3ShopAssetStorage(client, process.env['S3_PUBLIC_BASE_URL'] ?? process.env['S3_ENDPOINT']!);
  const shopId = randomUUID();

  afterAll(async () => { await storage.removeShopAssets(shopId); client.destroy(); });

  it('charge les deux familles de visuels et nettoie tout le prefixe boutique', async () => {
    const brand = await storage.uploadBrandAsset(shopId, {
      kind: 'hero', fileName: 'hero.webp', contentType: 'image/webp', bytes: new Uint8Array([1, 2]).buffer,
    });
    const mockup = await storage.uploadCustomMockup(shopId, {
      templateType: 'flyer', view: 'front', fileName: 'flyer.svg', contentType: 'image/svg+xml', bytes: new TextEncoder().encode('<svg/>').buffer,
    });
    expect(storage.publicUrl(brand)).toContain(`/shop-backgrounds/${shopId}/hero-`);
    expect(storage.publicUrl(mockup)).toBe(`${process.env['S3_PUBLIC_BASE_URL'] ?? process.env['S3_ENDPOINT']}/shop-product-mockups/${shopId}/flyer-front.svg`);
    const publicRead = await fetch(storage.publicUrl(mockup));
    expect(publicRead.status).toBe(200);
    expect(await publicRead.text()).toBe('<svg/>');
    const before = await Promise.all([
      client.send(new ListObjectsV2Command({ Bucket: storageBuckets.shop_backgrounds, Prefix: `${shopId}/` })),
      client.send(new ListObjectsV2Command({ Bucket: storageBuckets.shop_product_mockups, Prefix: `${shopId}/` })),
    ]);
    expect(before.map((page) => page.KeyCount)).toEqual([1, 1]);
    await storage.removeShopAssets(shopId);
    const after = await Promise.all([
      client.send(new ListObjectsV2Command({ Bucket: storageBuckets.shop_backgrounds, Prefix: `${shopId}/` })),
      client.send(new ListObjectsV2Command({ Bucket: storageBuckets.shop_product_mockups, Prefix: `${shopId}/` })),
    ]);
    expect(after.map((page) => page.KeyCount)).toEqual([0, 0]);
  });
});
