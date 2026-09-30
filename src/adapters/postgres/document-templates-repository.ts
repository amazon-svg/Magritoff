import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PoolClient } from 'pg';
import storageBuckets from '../../../config/storage-buckets.json';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type {
  ConfirmDocumentPdfTemplateUploadCommand,
  CreateDocumentPdfTemplateCommand,
  DocumentFieldPlacementDto,
  DocumentPdfTemplateCreatedDto,
  DocumentPdfTemplateDetailDto,
  DocumentPdfTemplateDto,
  DocumentPdfTemplateFieldMapDto,
  DocumentPdfTemplatePageDto,
  DocumentPdfTemplateUploadTicketDto,
  DocumentType,
  ReplaceDocumentPdfTemplateFieldsCommand,
  UpdateDocumentPdfTemplateCommand,
} from '../../modules/document-templates/api/contracts.ts';
import {
  DocumentPdfTemplateDefaultRequiresReadyError,
  DocumentPdfTemplateGeometryChangedError,
  DocumentPdfTemplateInUseError,
  DocumentPdfTemplateInvalidFieldMapError,
  DocumentPdfTemplateInvalidPdfError,
  DocumentPdfTemplateLimitReachedError,
  DocumentPdfTemplateNameConflictError,
  DocumentPdfTemplateNotFoundError,
  DocumentPdfTemplateUploadMissingError,
  DocumentPdfTemplateUploadRequiredError,
  type DocumentTemplatesRepository,
  type EligibleDocumentPdfTemplate,
  type ListDocumentPdfTemplatesFilters,
} from '../../modules/document-templates/application/document-templates-repository.ts';
import {
  inspectPdfTemplate,
  InvalidPdfTemplateError,
} from '../../modules/document-templates/application/pdf-template-inspector.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type TemplateRow = Record<string, unknown> & {
  id: string; tenant_id: string; created_at: Date; updated_at: Date;
};
type FieldRow = Record<string, unknown>;

const MAX_UPLOAD_BYTE_SIZE = 10 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 600;
const BACKGROUND_URL_TTL_SECONDS = 900;

export class PostgresDocumentTemplatesRepository implements DocumentTemplatesRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: S3Client,
    private readonly bucket = storageBuckets.document_pdf_templates,
  ) {}

  list(tenantId: TenantId, filters: ListDocumentPdfTemplatesFilters): Promise<readonly DocumentPdfTemplateDto[]> {
    return this.transactions.run({ tenantId }, async (client) => {
      const values: unknown[] = [tenantId];
      const clauses = ['tenant_id=$1'];
      if (filters.documentType !== null) { values.push(filters.documentType); clauses.push(`document_type=$${values.length}`); }
      if (filters.status !== null) { values.push(filters.status); clauses.push(`status=$${values.length}`); }
      const result = await client.query<TemplateRow>(`
        select * from public.document_pdf_templates where ${clauses.join(' and ')} order by name,id
      `, values);
      return result.rows.map(toTemplateDto);
    });
  }

  async findById(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateDetailDto | null> {
    const row = await this.transactions.run({ tenantId }, (client) => this.selectRow(client, tenantId, templateId));
    return row === null ? null : this.toDetailDto(tenantId, row);
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateDocumentPdfTemplateCommand,
  ): Promise<DocumentPdfTemplateCreatedDto> {
    const row = await this.write(tenantId, actor, async (client) => {
      const documentType = command.document_type ?? 'quote';
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`document-templates:${tenantId}:${documentType}`]);
      const count = await client.query<{ count: number }>(`
        select count(*)::integer as count from public.document_pdf_templates
         where tenant_id=$1 and document_type=$2
      `, [tenantId, documentType]);
      if ((count.rows[0]?.count ?? 0) >= 20) throw new DocumentPdfTemplateLimitReachedError();
      const result = await client.query<TemplateRow>(`
        insert into public.document_pdf_templates (
          tenant_id,document_type,name,requested_default,created_by
        ) values ($1,$2,$3,$4,$5) returning *
      `, [tenantId, documentType, command.name, command.is_default, actor]);
      return required(result.rows[0]);
    });
    return {
      template: await this.toDetailDto(tenantId, row),
      upload: await this.issueTicket(tenantId, row.id),
    };
  }

  async update(
    tenantId: TenantId,
    actor: UserId,
    templateId: string,
    command: UpdateDocumentPdfTemplateCommand,
  ): Promise<DocumentPdfTemplateDetailDto> {
    const row = await this.write(tenantId, actor, async (client) => {
      const current = await this.lockRow(client, tenantId, templateId);
      if (current === null) throw new DocumentPdfTemplateNotFoundError();
      let isActive = command.is_active ?? Boolean(current['is_active']);
      let isDefault = command.is_default ?? Boolean(current['is_default']);
      if (!isActive) isDefault = false;
      if (isDefault && (current['status'] !== 'ready' || !isActive)) {
        throw new DocumentPdfTemplateDefaultRequiresReadyError();
      }
      if (isDefault) {
        await client.query(`
          update public.document_pdf_templates set is_default=false
           where tenant_id=$1 and document_type=$2 and id<>$3 and is_default
        `, [tenantId, current['document_type'], templateId]);
      }
      const result = await client.query<TemplateRow>(`
        update public.document_pdf_templates set name=$3,is_default=$4,is_active=$5
         where tenant_id=$1 and id=$2 returning *
      `, [tenantId, templateId, command.name ?? current['name'], isDefault, isActive]);
      return required(result.rows[0]);
    });
    return this.toDetailDto(tenantId, row);
  }

  async remove(tenantId: TenantId, actor: UserId, templateId: string): Promise<void> {
    const existed = await this.write(tenantId, actor, async (client) => {
      const result = await client.query(
        'delete from public.document_pdf_templates where tenant_id=$1 and id=$2 returning id',
        [tenantId, templateId],
      );
      if (result.rowCount !== 1) throw new DocumentPdfTemplateNotFoundError();
      return true;
    });
    if (existed) await this.storage.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePathFor(tenantId, templateId) }));
  }

  async issueUploadUrl(
    tenantId: TenantId,
    actor: UserId,
    templateId: string,
  ): Promise<DocumentPdfTemplateUploadTicketDto> {
    const exists = await this.transactions.run({ tenantId, userId: actor }, async (client) =>
      (await this.selectRow(client, tenantId, templateId)) !== null);
    if (!exists) throw new DocumentPdfTemplateNotFoundError();
    return this.issueTicket(tenantId, templateId);
  }

  async confirmUpload(
    tenantId: TenantId,
    actor: UserId,
    templateId: string,
    command: ConfirmDocumentPdfTemplateUploadCommand,
  ): Promise<DocumentPdfTemplateDetailDto> {
    const path = storagePathFor(tenantId, templateId);
    let bytes: Uint8Array;
    try {
      bytes = await this.download(path);
    } catch (error) {
      if (isMissingObject(error)) throw new DocumentPdfTemplateUploadMissingError();
      throw error;
    }
    if (bytes.length > MAX_UPLOAD_BYTE_SIZE) {
      await this.storage.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: path }));
      throw new DocumentPdfTemplateInvalidPdfError('Le PDF dépasse la limite de 10 Mo.');
    }
    let inspected: Awaited<ReturnType<typeof inspectPdfTemplate>>;
    try {
      inspected = await inspectPdfTemplate(bytes);
    } catch (error) {
      await this.storage.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: path }));
      if (error instanceof InvalidPdfTemplateError) throw new DocumentPdfTemplateInvalidPdfError(error.message);
      throw error;
    }
    const digest = await sha256Hex(bytes);
    const row = await this.write(tenantId, actor, async (client) => {
      const current = await this.lockRow(client, tenantId, templateId);
      if (current === null) throw new DocumentPdfTemplateNotFoundError();
      const oldPages = toPagesDto(current['pages']);
      const hasMap = current['lines_block'] != null || await this.hasPlacements(client, tenantId, templateId);
      if (hasMap && !sameGeometry(oldPages, inspected.pages) && !command.reset_fields) {
        throw new DocumentPdfTemplateGeometryChangedError();
      }
      if (command.reset_fields) {
        await client.query('delete from public.document_pdf_template_fields where tenant_id=$1 and template_id=$2', [tenantId, templateId]);
      }
      // Un remplacement de fichier ne doit pas retirer silencieusement le
      // statut par defaut d'un gabarit deja publie. `requested_default` ne
      // sert qu'au premier depot ; `is_default` porte l'etat courant.
      const makeDefault = Boolean(current['requested_default']) || Boolean(current['is_default']);
      if (makeDefault) {
        await client.query(`update public.document_pdf_templates set is_default=false
          where tenant_id=$1 and document_type=$2 and id<>$3 and is_default`,
        [tenantId, current['document_type'], templateId]);
      }
      const result = await client.query<TemplateRow>(`
        update public.document_pdf_templates set status='ready',storage_path=$3,byte_size=$4,
          sha256=$5,page_count=$6,pages=$7::jsonb,lines_block=case when $8 then null else lines_block end,
          is_default=$9,requested_default=false
         where tenant_id=$1 and id=$2 returning *
      `, [tenantId, templateId, path, bytes.length, digest, inspected.pages.length,
        JSON.stringify(inspected.pages), command.reset_fields, makeDefault]);
      return required(result.rows[0]);
    });
    return this.toDetailDto(tenantId, row);
  }

  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.transactions.run({ tenantId, userId: actorId }, async (client) => {
      const result = await client.query<{ allowed: boolean }>('select magrit.actor_has_capability($1,$2) as allowed', [tenantId, capability]);
      return result.rows[0]?.allowed === true;
    });
  }

  getFields(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateFieldMapDto | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const template = await this.selectRow(client, tenantId, templateId);
      if (template === null) return null;
      return this.selectFieldMap(client, tenantId, templateId, template['lines_block'] as DocumentPdfTemplateFieldMapDto['lines_block']);
    });
  }

  replaceFields(
    tenantId: TenantId,
    actor: UserId,
    templateId: string,
    command: ReplaceDocumentPdfTemplateFieldsCommand,
  ): Promise<DocumentPdfTemplateFieldMapDto> {
    return this.write(tenantId, actor, async (client) => {
      const template = await this.lockRow(client, tenantId, templateId);
      if (template === null) throw new DocumentPdfTemplateNotFoundError();
      if (template['status'] !== 'ready') throw new DocumentPdfTemplateUploadRequiredError();
      await client.query('delete from public.document_pdf_template_fields where tenant_id=$1 and template_id=$2', [tenantId, templateId]);
      for (const placement of command.placements) {
        await client.query(`
          insert into public.document_pdf_template_fields (
            template_id,tenant_id,field,page_index,x,y,width,max_lines,align,font,font_size,color
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [templateId,tenantId,placement.field,placement.page_index,placement.x,placement.y,
          placement.width ?? null,placement.max_lines,placement.align,placement.font,placement.font_size,placement.color]);
      }
      await client.query('update public.document_pdf_templates set lines_block=$3::jsonb where tenant_id=$1 and id=$2',
        [tenantId, templateId, command.lines_block === null ? null : JSON.stringify(command.lines_block)]);
      return this.selectFieldMap(client, tenantId, templateId, command.lines_block);
    });
  }

  async findEligibleTemplateForGeneration(
    tenantId: TenantId,
    documentType: DocumentType,
  ): Promise<EligibleDocumentPdfTemplate | null> {
    const selected = await this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<TemplateRow>(`
        select * from public.document_pdf_templates
         where tenant_id=$1 and document_type=$2 and status='ready' and is_active and is_default
      `, [tenantId, documentType]);
      const row = result.rows[0];
      if (row === undefined) return null;
      const fields = await this.selectFieldMap(client, tenantId, row.id,
        row['lines_block'] as DocumentPdfTemplateFieldMapDto['lines_block']);
      if (fields.lines_block === null && fields.placements.length === 0) return null;
      return { row, fields };
    });
    if (selected === null) return null;
    let bytes: Uint8Array;
    try { bytes = await this.download(storagePathFor(tenantId, selected.row.id)); }
    catch (error) { if (isMissingObject(error)) return null; throw error; }
    return {
      templateId: selected.row.id,
      backgroundBytes: bytes,
      pages: toPagesDto(selected.row['pages']),
      placements: selected.fields.placements,
      linesBlock: selected.fields.lines_block,
    };
  }

  private async selectRow(client: PoolClient, tenantId: TenantId, templateId: string): Promise<TemplateRow | null> {
    const result = await client.query<TemplateRow>('select * from public.document_pdf_templates where tenant_id=$1 and id=$2', [tenantId, templateId]);
    return result.rows[0] ?? null;
  }

  private async lockRow(client: PoolClient, tenantId: TenantId, templateId: string): Promise<TemplateRow | null> {
    const result = await client.query<TemplateRow>('select * from public.document_pdf_templates where tenant_id=$1 and id=$2 for update', [tenantId, templateId]);
    return result.rows[0] ?? null;
  }

  private async hasPlacements(client: PoolClient, tenantId: TenantId, templateId: string): Promise<boolean> {
    const result = await client.query('select 1 from public.document_pdf_template_fields where tenant_id=$1 and template_id=$2 limit 1', [tenantId, templateId]);
    return result.rowCount === 1;
  }

  private async selectFieldMap(
    client: PoolClient,
    tenantId: TenantId,
    templateId: string,
    linesBlock: DocumentPdfTemplateFieldMapDto['lines_block'],
  ): Promise<DocumentPdfTemplateFieldMapDto> {
    const result = await client.query<FieldRow>(`
      select * from public.document_pdf_template_fields
       where tenant_id=$1 and template_id=$2 order by created_at,id
    `, [tenantId, templateId]);
    return { template_id: templateId, placements: result.rows.map(toPlacementDto), lines_block: linesBlock ?? null };
  }

  private async toDetailDto(tenantId: TenantId, row: TemplateRow): Promise<DocumentPdfTemplateDetailDto> {
    const hasFieldMap = await this.transactions.run({ tenantId }, async (client) =>
      row['lines_block'] != null || await this.hasPlacements(client, tenantId, row.id));
    let backgroundUrl: string | null = null;
    let expiresAt: string | null = null;
    if (row['status'] === 'ready') {
      backgroundUrl = await getSignedUrl(this.storage, new GetObjectCommand({
        Bucket: this.bucket, Key: storagePathFor(tenantId, row.id),
      }), { expiresIn: BACKGROUND_URL_TTL_SECONDS });
      expiresAt = new Date(Date.now() + BACKGROUND_URL_TTL_SECONDS * 1000).toISOString();
    }
    return {
      ...toTemplateDto(row), pages: toPagesDto(row['pages']), sha256: row['sha256'] as string | null,
      has_field_map: hasFieldMap, background_url: backgroundUrl, background_url_expires_at: expiresAt,
    };
  }

  private async issueTicket(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateUploadTicketDto> {
    const path = storagePathFor(tenantId, templateId);
    const url = await getSignedUrl(this.storage, new PutObjectCommand({
      Bucket: this.bucket, Key: path, ContentType: 'application/pdf',
    }), { expiresIn: UPLOAD_URL_TTL_SECONDS });
    return {
      url, token: new URL(url).searchParams.get('X-Amz-Signature') ?? 's3-presigned-put', path,
      content_type: 'application/pdf', max_byte_size: MAX_UPLOAD_BYTE_SIZE,
      expires_at: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  private async download(path: string): Promise<Uint8Array> {
    const result = await this.storage.send(new GetObjectCommand({ Bucket: this.bucket, Key: path }));
    if (result.Body === undefined) throw new Error(`Objet S3 vide : ${path}`);
    return result.Body.transformToByteArray();
  }

  private write<T>(tenantId: TenantId, actor: UserId, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.transactions.run({ tenantId, userId: actor }, async (client) => {
      try { return await operation(client); } catch (error) { throw mapError(error); }
    });
  }
}

function storagePathFor(tenantId: TenantId, templateId: string): string { return `${tenantId}/${templateId}.pdf`; }
function required<T>(value: T | undefined): T { if (value === undefined) throw new Error('Ligne PostgreSQL absente.'); return value; }
function toTemplateDto(row: TemplateRow): DocumentPdfTemplateDto { return {
  id: row.id, document_type: row['document_type'] as DocumentType, name: String(row['name']),
  status: row['status'] as DocumentPdfTemplateDto['status'], is_default: Boolean(row['is_default']),
  is_active: Boolean(row['is_active']), page_count: row['page_count'] == null ? null : Number(row['page_count']),
  byte_size: row['byte_size'] == null ? null : Number(row['byte_size']),
  created_at: toIsoTimestamp(row.created_at), updated_at: toIsoTimestamp(row.updated_at),
}; }
function toPagesDto(raw: unknown): DocumentPdfTemplatePageDto[] {
  return Array.isArray(raw) ? raw.map((page: Record<string, unknown>) => ({
    index: Number(page['index']), width_pt: Number(page['width_pt']), height_pt: Number(page['height_pt']),
  })) : [];
}
function toPlacementDto(row: FieldRow): DocumentFieldPlacementDto { return {
  field: row['field'] as DocumentFieldPlacementDto['field'], page_index: Number(row['page_index']),
  x: Number(row['x']), y: Number(row['y']), width: row['width'] == null ? null : Number(row['width']),
  max_lines: Number(row['max_lines']), align: row['align'] as DocumentFieldPlacementDto['align'],
  font: row['font'] as DocumentFieldPlacementDto['font'], font_size: Number(row['font_size']), color: String(row['color']),
}; }
function sameGeometry(left: readonly DocumentPdfTemplatePageDto[], right: readonly DocumentPdfTemplatePageDto[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function isMissingObject(error: unknown): boolean {
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value.name === 'NoSuchKey' || value.name === 'NotFound' || value.$metadata?.httpStatusCode === 404;
}
function mapError(error: unknown): Error {
  if (error instanceof DocumentPdfTemplateDefaultRequiresReadyError ||
      error instanceof DocumentPdfTemplateGeometryChangedError ||
      error instanceof DocumentPdfTemplateInUseError ||
      error instanceof DocumentPdfTemplateInvalidFieldMapError ||
      error instanceof DocumentPdfTemplateInvalidPdfError ||
      error instanceof DocumentPdfTemplateLimitReachedError ||
      error instanceof DocumentPdfTemplateNameConflictError ||
      error instanceof DocumentPdfTemplateNotFoundError ||
      error instanceof DocumentPdfTemplateUploadMissingError ||
      error instanceof DocumentPdfTemplateUploadRequiredError) return error;
  const value = error as { code?: string; constraint?: string; message?: string };
  if (value.code === '23505') {
    if (value.constraint === 'document_pdf_template_fields_unique_field') {
      return new DocumentPdfTemplateInvalidFieldMapError([{ field: 'placements', message: 'Un champ est placé plusieurs fois.' }]);
    }
    return new DocumentPdfTemplateNameConflictError(value.message);
  }
  if (value.code === '23503') return new DocumentPdfTemplateInUseError(value.message);
  if (value.code === '23514') return new DocumentPdfTemplateInvalidFieldMapError([
    { field: 'placements', message: value.message ?? 'Carte de champs invalide.' },
  ]);
  return error instanceof Error ? error : new Error(String(error));
}
