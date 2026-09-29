import { beforeEach, describe, expect, it } from 'vitest';
import { parseId, type TenantId, type UserId } from '@/kernel';
import { InMemoryIdempotencyStore, type ApiPrincipal, type PrincipalVerifier } from '@/modules/_shared/application';
import { CommercialLineFilesService } from '@/modules/commercial-line-files/application/commercial-line-files-service';
import type { CommercialLineFilesRepository } from '@/modules/commercial-line-files/application/commercial-line-files-repository';
import type {
  CommercialLineFileDetailDto,
  CommercialLineFileDto,
  CommercialLineType,
  UploadCommercialLineFileCommand,
} from '@/modules/commercial-line-files/api/contracts';
import { createCommercialLineFilesRoutes } from '@/server/api/commercial-line-files-routes';
import { createGescomApiHandler } from '@/server/api';
import { checkResponseAgainstContract } from './_harness';

const TENANT = brand<TenantId>('7f0d2a1e-1c4b-4f8a-9c3d-5b6e7a8f9099');
const USER = brand<UserId>('a1b2c3d4-e5f6-4708-8910-1a2b3c4d5099');
const LINE_ID = '10000000-0000-4000-8000-000000000001';

function brand<T extends string>(value: string): T {
  const parsed = parseId(value);
  if (!parsed.ok) throw new Error('identifiant de test invalide');
  return parsed.value as T;
}

class MemoryRepository implements CommercialLineFilesRepository {
  files: CommercialLineFileDto[] = [];

  async list(_tenantId: TenantId, _lineType: CommercialLineType, _lineId: string) {
    return this.files;
  }

  async upload(_tenantId: TenantId, _lineType: CommercialLineType, _lineId: string, command: UploadCommercialLineFileCommand) {
    const file: CommercialLineFileDto = {
      id: '20000000-0000-4000-8000-000000000001',
      kind: command.kind,
      visibility: command.visibility,
      filename: command.filename,
      content_type: command.content_type,
      byte_size: 8,
      created_at: '2026-09-28T12:00:00.000Z',
    };
    this.files = [file];
    return file;
  }

  async getForRead(_tenantId: TenantId, _lineType: CommercialLineType, _lineId: string, fileId: string): Promise<CommercialLineFileDetailDto> {
    const file = this.files.find((candidate) => candidate.id === fileId)!;
    return {
      ...file,
      preview_url: 'https://files.test/preview',
      download_url: 'https://files.test/download',
      url_expires_at: '2026-09-28T12:05:00.000Z',
    };
  }
}

const principal: ApiPrincipal = { kind: 'user', userId: USER, tenantId: TENANT };
const servicePrincipal: ApiPrincipal = { kind: 'service', serviceId: 'studio', tenantId: TENANT, scopes: [] };
const verifier: PrincipalVerifier = {
  async verify(credential) {
    if (credential.kind === 'bearer' && credential.token === 'valid') return principal;
    if (credential.kind === 'service_key' && credential.key === 'studio') return servicePrincipal;
    return null;
  },
};

let handler: (request: Request) => Promise<Response>;

beforeEach(() => {
  const service = new CommercialLineFilesService(new MemoryRepository());
  handler = createGescomApiHandler({
    routes: createCommercialLineFilesRoutes(service),
    principalVerifier: verifier,
    idempotencyStore: new InMemoryIdempotencyStore(),
  });
});

function call(path: string, init: RequestInit = {}) {
  return handler(new Request(`https://magrit.test${path}`, init));
}

describe('fichiers des lignes commerciales', () => {
  it('ajoute, liste puis ouvre le même fichier sur une ligne', async () => {
    const base = `/api/v1/commercial-line-files/project_item/${LINE_ID}`;
    const uploaded = await call(base, {
      method: 'POST',
      headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json', 'Idempotency-Key': 'line-file-0001' },
      body: JSON.stringify({
        kind: 'cutting_template',
        filename: 'decoupe.pdf',
        content_type: 'application/pdf',
        data_base64: 'JVBERg==',
      }),
    });
    expect((await checkResponseAgainstContract(uploaded.clone(), { status: 201, dataSchema: 'CommercialLineFile' })).errors).toEqual([]);
    const file = (await uploaded.json()).data as CommercialLineFileDto;

    const listed = await call(base, { headers: { Authorization: 'Bearer valid' } });
    expect((await checkResponseAgainstContract(listed.clone(), { status: 200 })).errors).toEqual([]);
    expect(((await listed.json()).data as CommercialLineFileDto[])[0]?.kind).toBe('cutting_template');

    const detail = await call(`${base}/${file.id}`, { headers: { Authorization: 'Bearer valid' } });
    expect((await checkResponseAgainstContract(detail.clone(), { status: 200, dataSchema: 'CommercialLineFileDetail' })).errors).toEqual([]);
    expect(((await detail.json()).data as CommercialLineFileDetailDto).download_url).toContain('/download');
  });

  it('refuse une clé de service sur les fichiers des lignes', async () => {
    const response = await call(`/api/v1/commercial-line-files/order_line/${LINE_ID}`, {
      headers: { 'X-Magrit-Service-Key': 'studio' },
    });
    expect(response.status).toBe(403);
  });
});
