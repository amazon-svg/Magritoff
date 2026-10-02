import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { S3OrderExportStorage } from '../../../src/adapters/s3/order-exports-storage.ts';
import type { TenantId } from '../../../src/kernel/ids/index.ts';

function clientWith(send: ReturnType<typeof vi.fn>): S3Client {
  return { send } as unknown as S3Client;
}

describe('S3OrderExportStorage', () => {
  it('depose dans le bucket S3 mappe sans ecrasement', async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3OrderExportStorage(clientWith(send));
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(storage.upload({
      tenantId: '00000000-0000-4000-8000-000000000001' as TenantId,
      exportId: 'export-42',
      extension: 'xlsx',
      bytes,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })).resolves.toEqual({
      storagePath: '00000000-0000-4000-8000-000000000001/export-42.xlsx',
    });

    expect(send).toHaveBeenCalledOnce();
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'order-exports',
      Key: '00000000-0000-4000-8000-000000000001/export-42.xlsx',
      Body: bytes,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      IfNoneMatch: '*',
    });
  });

  it('conserve la cause S3 et le contexte de l export en cas d echec', async () => {
    const cause = new Error('Precondition Failed');
    const storage = new S3OrderExportStorage(clientWith(vi.fn().mockRejectedValue(cause)));

    await expect(storage.upload({
      tenantId: '00000000-0000-4000-8000-000000000001' as TenantId,
      exportId: 'export-duplicate',
      extension: 'csv',
      bytes: new Uint8Array(),
      contentType: 'text/csv',
    })).rejects.toMatchObject({
      message: 'Depot du fichier d export export-duplicate impossible: Precondition Failed',
      cause,
    });
  });

  it('permet d injecter un nom de bucket pour un environnement isole', async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3OrderExportStorage(clientWith(send), 'test-order-exports');

    await storage.upload({
      tenantId: '00000000-0000-4000-8000-000000000001' as TenantId,
      exportId: 'export-43',
      extension: 'csv',
      bytes: new Uint8Array([4]),
      contentType: 'text/csv',
    });

    expect(send.mock.calls[0]?.[0].input.Bucket).toBe('test-order-exports');
  });
});
