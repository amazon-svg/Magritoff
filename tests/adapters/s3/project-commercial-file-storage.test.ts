import { DeleteObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { S3ProjectCommercialFileStorage } from '../../../src/adapters/s3/project-commercial-file-storage.ts';
import type { TenantId } from '../../../src/kernel/ids/index.ts';

describe('S3ProjectCommercialFileStorage', () => {
  it('depose sans ecrasement puis supprime par cle portable', async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3ProjectCommercialFileStorage(
      { send } as unknown as S3Client,
      'commercial-files-test',
    );
    const tenantId = '11111111-1111-4111-8111-111111111111' as TenantId;
    const fileId = '22222222-2222-4222-8222-222222222222';
    const result = await storage.upload({
      tenantId, fileId, bytes: new Uint8Array([1, 2, 3]), contentType: 'application/pdf',
    });
    expect(result.storagePath).toBe(`${tenantId}/${fileId}`);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    expect((send.mock.calls[0]?.[0] as PutObjectCommand).input).toMatchObject({
      Bucket: 'commercial-files-test', Key: result.storagePath, IfNoneMatch: '*',
    });

    await storage.remove(result.storagePath);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls[1]?.[0] as DeleteObjectCommand).input).toMatchObject({
      Bucket: 'commercial-files-test', Key: result.storagePath,
    });
  });
});
