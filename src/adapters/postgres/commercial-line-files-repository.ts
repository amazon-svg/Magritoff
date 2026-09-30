import type { TenantId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import {
  CommercialLineFileNotFoundError,
  type CommercialLineFileObjectStorage,
  type CommercialLineFilesRepository,
} from '../../modules/commercial-line-files/application/commercial-line-files-repository.ts';
import type {
  CommercialLineFileDetailDto,
  CommercialLineFileDto,
  CommercialLineType,
  UploadCommercialLineFileCommand,
} from '../../modules/commercial-line-files/api/contracts.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

const URL_TTL_SECONDS = 300;

type FileRow = Readonly<{
  id: string;
  kind: CommercialLineFileDto['kind'];
  visibility: CommercialLineFileDto['visibility'];
  filename: string;
  content_type: string;
  byte_size: string;
  storage_path: string;
  created_at: Date;
}>;

export class PostgresCommercialLineFilesRepository implements CommercialLineFilesRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: CommercialLineFileObjectStorage,
  ) {}

  async list(
    tenantId: TenantId,
    lineType: CommercialLineType,
    lineId: string,
  ): Promise<readonly CommercialLineFileDto[]> {
    assertProjectItem(lineType);
    return this.transactions.run({ tenantId }, async (client) => {
      const exists = await client.query(
        'select 1 from public.project_items where tenant_id = $1 and id = $2',
        [tenantId, lineId],
      );
      if (exists.rowCount !== 1) throw new CommercialLineFileNotFoundError();
      const result = await client.query<FileRow>(`
        select file.* from public.project_item_files link
        join public.commercial_files file
          on file.tenant_id = link.tenant_id and file.id = link.file_id
        where link.tenant_id = $1 and link.project_item_id = $2
        order by file.created_at desc, file.id desc
      `, [tenantId, lineId]);
      return result.rows.map(toDto);
    });
  }

  async getForRead(
    tenantId: TenantId,
    lineType: CommercialLineType,
    lineId: string,
    fileId: string,
  ): Promise<CommercialLineFileDetailDto> {
    assertProjectItem(lineType);
    const row = await this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<FileRow>(`
        select file.* from public.project_item_files link
        join public.commercial_files file
          on file.tenant_id = link.tenant_id and file.id = link.file_id
        where link.tenant_id = $1 and link.project_item_id = $2 and file.id = $3
      `, [tenantId, lineId, fileId]);
      if (result.rows[0] === undefined) throw new CommercialLineFileNotFoundError();
      return result.rows[0];
    });
    const [previewUrl, downloadUrl] = await Promise.all([
      this.storage.createReadUrl({
        storagePath: row.storage_path,
        filename: row.filename,
        download: false,
        expiresInSeconds: URL_TTL_SECONDS,
      }),
      this.storage.createReadUrl({
        storagePath: row.storage_path,
        filename: row.filename,
        download: true,
        expiresInSeconds: URL_TTL_SECONDS,
      }),
    ]);
    return {
      ...toDto(row),
      preview_url: previewUrl,
      download_url: downloadUrl,
      url_expires_at: new Date(Date.now() + URL_TTL_SECONDS * 1_000).toISOString(),
    };
  }

  async upload(
    tenantId: TenantId,
    lineType: CommercialLineType,
    lineId: string,
    command: UploadCommercialLineFileCommand,
  ): Promise<CommercialLineFileDto> {
    assertProjectItem(lineType);
    await this.transactions.run({ tenantId }, async (client) => {
      const exists = await client.query(
        'select 1 from public.project_items where tenant_id = $1 and id = $2',
        [tenantId, lineId],
      );
      if (exists.rowCount !== 1) throw new CommercialLineFileNotFoundError();
    });

    const fileId = crypto.randomUUID();
    const bytes = decodeBase64(command.data_base64);
    if (bytes.byteLength === 0 || bytes.byteLength > 15_000_000) {
      throw new Error('Le fichier doit peser entre 1 octet et 15 Mo.');
    }
    const uploaded = await this.storage.upload({
      tenantId, fileId, bytes, contentType: command.content_type,
    });
    try {
      return await this.transactions.run({ tenantId }, async (client) => {
        const result = await client.query<FileRow>(`
          insert into public.commercial_files (
            id, tenant_id, kind, visibility, filename, content_type, byte_size, storage_path
          ) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *
        `, [
          fileId, tenantId, command.kind, command.visibility, command.filename,
          command.content_type, bytes.byteLength, uploaded.storagePath,
        ]);
        await client.query(`
          insert into public.project_item_files (tenant_id, project_item_id, file_id)
          values ($1, $2, $3)
        `, [tenantId, lineId, fileId]);
        return toDto(result.rows[0]!);
      });
    } catch (error) {
      await this.storage.remove(uploaded.storagePath).catch(() => undefined);
      const value = error as { code?: string };
      if (value.code === '23503') throw new CommercialLineFileNotFoundError();
      throw error;
    }
  }
}

function assertProjectItem(lineType: CommercialLineType): void {
  if (lineType !== 'project_item') throw new CommercialLineFileNotFoundError();
}

function toDto(row: FileRow): CommercialLineFileDto {
  return {
    id: row.id,
    kind: row.kind,
    visibility: row.visibility,
    filename: row.filename,
    content_type: row.content_type,
    byte_size: Number(row.byte_size),
    created_at: toIsoTimestamp(row.created_at),
  };
}

function decodeBase64(value: string): Uint8Array {
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new Error('Le contenu du fichier doit etre un base64 valide.');
  }
}
