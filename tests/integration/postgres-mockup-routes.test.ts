import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { afterAll, describe, expect, it } from 'vitest';
import { createS3Client } from '../../src/adapters/s3/client.ts';
import { createMockupHandler } from '../../src/server/api/mockup-routes.ts';

const describeIntegration = process.env['MAGRIT_POSTGRES_INTEGRATION'] === '1' ? describe : describe.skip;

describeIntegration('route de mockups Node/S3', () => {
  const storage = createS3Client({
    S3_ENDPOINT: process.env['S3_ENDPOINT'] ?? 'http://127.0.0.1:58333',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: process.env['S3_ACCESS_KEY_ID'] ?? 'magrit-local',
    S3_SECRET_ACCESS_KEY: process.env['S3_SECRET_ACCESS_KEY'] ?? 'magrit-local-secret',
    S3_FORCE_PATH_STYLE: 'true',
  });
  const bucket = 'product-mockups';
  const tenantId = randomUUID();
  const shopId = randomUUID();
  const productId = randomUUID();
  const key = `${tenantId}/${shopId}/${productId}_v7.png`;
  const handler = createMockupHandler(storage, bucket);

  afterAll(async () => {
    await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    storage.destroy();
  });

  it('rend, met en cache puis sert un PNG sans Edge Function', async () => {
    const query = new URLSearchParams({
      tenant: tenantId,
      shop: shopId,
      product: productId,
      width: '148',
      height: '210',
      productName: 'Flyer portable',
      primaryColor: '#1e3a8a',
      template: 'flyer',
    });
    const rendered = await handler(new Request(`http://magrit.test/api/v1/mockups/render?${query}`));
    expect(rendered.status).toBe(200);
    expect(rendered.headers.get('content-type')).toBe('image/png');
    expect(rendered.headers.get('x-mockup-cache')).toBe('MISS');
    const bytes = new Uint8Array(await rendered.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const hit = await handler(new Request(`http://magrit.test/api/v1/mockups/render?${query}`));
    expect(hit.status).toBe(302);
    expect(hit.headers.get('location')).toBe(`/api/v1/mockups/public/${key}`);
    expect(hit.headers.get('x-mockup-cache')).toBe('HIT');

    const publicResponse = await handler(new Request(`http://magrit.test/api/v1/mockups/public/${key}`));
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await publicResponse.arrayBuffer())).toEqual(bytes);
  });

  it('rejette les paramètres et chemins non canoniques', async () => {
    await expect(handler(new Request(
      'http://magrit.test/api/v1/mockups/render?tenant=x&shop=y&product=z&width=-1&height=2&productName=x&primaryColor=%23000000',
    )).then((response) => response.status)).resolves.toBe(400);
    await expect(handler(new Request(
      'http://magrit.test/api/v1/mockups/public/not/a/canonical.png',
    )).then((response) => response.status)).resolves.toBe(404);
  });
});
