import { describe, expect, it, vi } from 'vitest';
import { S3ShopAssetStorage } from '../../../src/adapters/s3/shop-asset-storage.ts';

describe('S3ShopAssetStorage', () => {
  it('conserve une reference S3 stable et expose une URL path-style', async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3ShopAssetStorage({ send } as never, 'http://127.0.0.1:58333/');
    const stored = await storage.uploadBrandAsset('shop-id', {
      kind: 'logo', fileName: 'logo.png', contentType: 'image/png', bytes: new Uint8Array([1]).buffer,
    });
    expect(stored).toMatch(/^s3:\/\/shop-backgrounds\/shop-id\/logo-[a-f0-9-]+\.png$/);
    expect(storage.publicUrl(stored)).toMatch(/^http:\/\/127\.0\.0\.1:58333\/shop-backgrounds\/shop-id\/logo-/);
    expect(storage.reference(storage.publicUrl(stored))).toBe(stored);
    expect(send).toHaveBeenCalledOnce();
  });

  it('ne reecrit pas les URL externes', () => {
    const storage = new S3ShopAssetStorage({ send: vi.fn() } as never, 'https://assets.magrit.example/base');
    expect(storage.reference('https://cdn.example/logo.png')).toBe('https://cdn.example/logo.png');
    expect(storage.publicUrl('https://cdn.example/logo.png')).toBe('https://cdn.example/logo.png');
  });
});
