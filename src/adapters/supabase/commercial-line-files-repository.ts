import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId } from '../../kernel/ids/index.ts';
import {
  CommercialLineFileNotFoundError,
  type CommercialLineFilesRepository,
} from '../../modules/commercial-line-files/application/commercial-line-files-repository.ts';
import type {
  CommercialLineFileDetailDto,
  CommercialLineFileDto,
  CommercialLineType,
  UploadCommercialLineFileCommand,
} from '../../modules/commercial-line-files/api/contracts.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import { publicAssetUrl } from './shops-repository.ts';

const BUCKET = 'commercial_line_files';
const URL_TTL_SECONDS = 300;

const LINKS = {
  project_item: { table: 'project_item_files', key: 'project_item_id' },
  quote_line: { table: 'commercial_quote_line_files', key: 'quote_line_id' },
  order_line: { table: 'commercial_order_line_files', key: 'order_line_id' },
} as const;

export class SupabaseCommercialLineFilesRepository implements CommercialLineFilesRepository {
  constructor(
    private readonly client: SupabaseClient<any>,
    private readonly publicBaseUrl?: string,
  ) {}

  async list(
    tenantId: TenantId,
    lineType: CommercialLineType,
    lineId: string,
  ): Promise<readonly CommercialLineFileDto[]> {
    const link = LINKS[lineType];
    const { data, error } = await this.client
      .from(link.table)
      .select('commercial_files!inner(id, tenant_id, kind, filename, content_type, byte_size, created_at)')
      .eq(link.key, lineId)
      .eq('commercial_files.tenant_id', tenantId);
    if (error) throw new Error(error.message);
    return (data ?? []).flatMap((row: Record<string, unknown>) => {
      const nested = row['commercial_files'];
      const file = Array.isArray(nested) ? nested[0] : nested;
      return isRecord(file) ? [toDto(file)] : [];
    }).sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  async getForRead(
    tenantId: TenantId,
    lineType: CommercialLineType,
    lineId: string,
    fileId: string,
  ): Promise<CommercialLineFileDetailDto> {
    const file = (await this.list(tenantId, lineType, lineId)).find((candidate) => candidate.id === fileId);
    if (!file) throw new CommercialLineFileNotFoundError();
    const path = `${tenantId}/${file.id}`;
    const [preview, download] = await Promise.all([
      this.client.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECONDS),
      this.client.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECONDS, { download: file.filename }),
    ]);
    if (preview.error || !preview.data || download.error || !download.data) {
      throw new Error(preview.error?.message ?? download.error?.message ?? 'Création du lien de fichier impossible.');
    }
    return {
      ...file,
      preview_url: publicAssetUrl(preview.data.signedUrl, this.publicBaseUrl),
      download_url: publicAssetUrl(download.data.signedUrl, this.publicBaseUrl),
      url_expires_at: new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  async upload(
    tenantId: TenantId,
    lineType: CommercialLineType,
    lineId: string,
    command: UploadCommercialLineFileCommand,
  ): Promise<CommercialLineFileDto> {
    const fileId = crypto.randomUUID();
    const storagePath = `${tenantId}/${fileId}`;
    const bytes = decodeBase64(command.data_base64);
    if (bytes.byteLength === 0 || bytes.byteLength > 15_000_000) {
      throw new Error('Le fichier doit peser entre 1 octet et 15 Mo.');
    }

    const { error: uploadError } = await this.client.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: command.content_type, upsert: false });
    if (uploadError) throw new Error(`Téléversement impossible : ${uploadError.message}`);

    const { error } = await this.client.rpc('api_attach_commercial_line_file', {
      p_tenant_id: tenantId,
      p_line_type: lineType,
      p_line_id: lineId,
      p_file_id: fileId,
      p_kind: command.kind,
      p_filename: command.filename,
      p_content_type: command.content_type,
      p_byte_size: bytes.byteLength,
      p_storage_path: storagePath,
    });
    if (error) {
      await this.client.storage.from(BUCKET).remove([storagePath]);
      if (error.message.includes('commercial_line.not_found')) throw new CommercialLineFileNotFoundError();
      throw new Error(error.message);
    }

    return {
      id: fileId,
      kind: command.kind,
      filename: command.filename,
      content_type: command.content_type,
      byte_size: bytes.byteLength,
      created_at: new Date().toISOString(),
    };
  }
}

function toDto(row: Record<string, unknown>): CommercialLineFileDto {
  return {
    id: String(row['id']),
    kind: row['kind'] as CommercialLineFileDto['kind'],
    filename: String(row['filename']),
    content_type: String(row['content_type']),
    byte_size: Number(row['byte_size']),
    created_at: toIsoTimestamp(String(row['created_at'])),
  };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
