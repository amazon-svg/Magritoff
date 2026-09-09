/**
 * Faux repository Gabarits PDF de documents (E10.10b-4a), utilise par
 * `document-templates.contract.test.ts`.
 *
 * Reimplemente FIDELEMENT les regles tenues EN BASE par la migration
 * `20260909020000` : unicite du nom normalise PAR TYPE DE DOCUMENT, plafond
 * de 20, bascule `is_default` transactionnelle (retire le drapeau au
 * precedent), `default_requires_ready`, application DIFFEREE de
 * `requested_default` a la confirmation d import, `geometry_changed` si la
 * carte (`lines_block`) n est pas vide et que la geometrie change sans
 * `reset_fields`.
 *
 * N EXERCE PAS `pdf-lib` : la geometrie d un depot est STAGEE explicitement
 * par le test (`stagePdfForTest`/`stageInvalidPdfForTest`), exactement comme
 * si `pdf-template-inspector.ts` avait deja tourne — ce module pur a son
 * propre test unitaire (`tests/modules/document-templates/pdf-template-inspector.test.ts`),
 * execute pour de vrai contre `pdf-lib`.
 */
import type { TenantId, UserId } from '@/kernel';
import {
  DocumentPdfTemplateDefaultRequiresReadyError,
  DocumentPdfTemplateGeometryChangedError,
  DocumentPdfTemplateInvalidPdfError,
  DocumentPdfTemplateLimitReachedError,
  DocumentPdfTemplateNameConflictError,
  DocumentPdfTemplateNotFoundError,
  DocumentPdfTemplateUploadMissingError,
  DocumentPdfTemplateUploadRequiredError,
  type DocumentTemplatesRepository,
  type EligibleDocumentPdfTemplate,
  type ListDocumentPdfTemplatesFilters,
} from '@/modules/document-templates/application/document-templates-repository';
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
} from '@/modules/document-templates/api/contracts';

let sequence = 0;
export function fakeTemplateUuid(): string {
  sequence += 1;
  return `00000000-0000-4000-9300-${String(sequence).padStart(12, '0')}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

type StoredTemplate = {
  id: string;
  tenant_id: string;
  document_type: DocumentType;
  name: string;
  status: 'awaiting_upload' | 'ready';
  storage_path: string | null;
  byte_size: number | null;
  sha256: string | null;
  page_count: number | null;
  pages: DocumentPdfTemplatePageDto[];
  lines_block: Record<string, unknown> | null;
  is_default: boolean;
  is_active: boolean;
  requested_default: boolean;
  created_at: string;
  updated_at: string;
};

type StagedUpload =
  | { kind: 'valid'; pageCount: number; pages: DocumentPdfTemplatePageDto[] }
  | { kind: 'invalid' };

export class InMemoryDocumentTemplatesRepository implements DocumentTemplatesRepository {
  private readonly templates = new Map<string, StoredTemplate>();
  private readonly stagedUploads = new Map<string, StagedUpload>();
  /** E10.10b-4b — placements PERSISTES par gabarit (`document_pdf_template_fields`). */
  private readonly placementsByTemplate = new Map<string, DocumentFieldPlacementDto[]>();
  /** Droit `can_manage_document_templates` par tenant+acteur. `true` par defaut (equivalent d un `admin`). */
  private readonly actorCapabilities = new Map<string, boolean>();
  private ticketCounter = 0;

  /** TEST UNIQUEMENT. */
  setActorCapabilityForTest(tenantId: string, actorId: string, capability: string, granted: boolean | null): void {
    const key = `${tenantId}:${actorId}:${capability}`;
    if (granted === null) this.actorCapabilities.delete(key);
    else this.actorCapabilities.set(key, granted);
  }

  /** TEST UNIQUEMENT — seed direct, sans passer par `create()`. */
  seedForTest(overrides: Partial<StoredTemplate> & { id: string; tenant_id: string }): void {
    const now = new Date().toISOString();
    const template: StoredTemplate = {
      document_type: 'quote',
      name: 'Gabarit de test',
      status: 'awaiting_upload',
      storage_path: null,
      byte_size: null,
      sha256: null,
      page_count: null,
      pages: [],
      lines_block: null,
      is_default: false,
      is_active: true,
      requested_default: false,
      created_at: now,
      updated_at: now,
      ...overrides,
    };
    this.templates.set(template.id, template);
  }

  /** TEST UNIQUEMENT — simule un depot reussi (comme si pdf-lib avait relu le fichier). */
  stagePdfForTest(templateId: string, pageCount: number, pages: DocumentPdfTemplatePageDto[]): void {
    this.stagedUploads.set(templateId, { kind: 'valid', pageCount, pages });
  }

  /** TEST UNIQUEMENT — simule un fichier refuse par `pdf-template-inspector.ts` (422 invalid_pdf). */
  stageInvalidPdfForTest(templateId: string): void {
    this.stagedUploads.set(templateId, { kind: 'invalid' });
  }

  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    return this.actorCapabilities.get(`${tenantId}:${actorId}:${capability}`) ?? true;
  }

  /**
   * E10.19a — non exercee par ce test de contrat (module `document-templates`
   * seul, la generation vit dans `quote-documents`/E10.19b) : implementee
   * pour la conformite de l interface, jamais appelee ici.
   */
  async findEligibleTemplateForGeneration(
    tenantId: TenantId,
    documentType: DocumentType,
  ): Promise<EligibleDocumentPdfTemplate | null> {
    void tenantId;
    void documentType;
    return null;
  }

  async list(
    tenantId: TenantId,
    filters: ListDocumentPdfTemplatesFilters,
  ): Promise<readonly DocumentPdfTemplateDto[]> {
    return [...this.templates.values()]
      .filter((row) => row.tenant_id === tenantId)
      .filter((row) => filters.documentType === null || row.document_type === filters.documentType)
      .filter((row) => filters.status === null || row.status === filters.status)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(toSummaryDto);
  }

  async findById(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateDetailDto | null> {
    const row = this.find(tenantId, templateId);
    return row ? this.toDetailDto(row) : null;
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateDocumentPdfTemplateCommand,
  ): Promise<DocumentPdfTemplateCreatedDto> {
    void actor;
    const documentType = command.document_type ?? 'quote';
    const tenantTemplates = [...this.templates.values()].filter(
      (row) => row.tenant_id === tenantId && row.document_type === documentType,
    );
    if (tenantTemplates.length >= 20) throw new DocumentPdfTemplateLimitReachedError();

    const normalized = normalizeName(command.name);
    if (tenantTemplates.some((row) => normalizeName(row.name) === normalized)) {
      throw new DocumentPdfTemplateNameConflictError();
    }

    const now = new Date().toISOString();
    const row: StoredTemplate = {
      id: fakeTemplateUuid(),
      tenant_id: tenantId,
      document_type: documentType,
      name: command.name,
      status: 'awaiting_upload',
      storage_path: null,
      byte_size: null,
      sha256: null,
      page_count: null,
      pages: [],
      lines_block: null,
      is_default: false,
      is_active: true,
      requested_default: command.is_default,
      created_at: now,
      updated_at: now,
    };
    this.templates.set(row.id, row);

    return { template: this.toDetailDto(row), upload: this.issueTicketFor(row.id) };
  }

  async update(
    tenantId: TenantId,
    templateId: string,
    command: UpdateDocumentPdfTemplateCommand,
  ): Promise<DocumentPdfTemplateDetailDto> {
    const current = this.find(tenantId, templateId);
    if (!current) throw new DocumentPdfTemplateNotFoundError();

    if ('name' in command && command.name !== undefined) {
      const normalized = normalizeName(command.name);
      const conflict = [...this.templates.values()].some(
        (row) =>
          row.tenant_id === tenantId &&
          row.document_type === current.document_type &&
          row.id !== templateId &&
          normalizeName(row.name) === normalized,
      );
      if (conflict) throw new DocumentPdfTemplateNameConflictError();
    }

    const nextIsActive = 'is_active' in command && command.is_active !== undefined ? command.is_active : current.is_active;
    let nextIsDefault = 'is_default' in command && command.is_default !== undefined ? command.is_default : current.is_default;

    if ('is_default' in command && command.is_default === true) {
      if (!(current.status === 'ready' && nextIsActive)) {
        throw new DocumentPdfTemplateDefaultRequiresReadyError();
      }
    }
    if (!nextIsActive && nextIsDefault) nextIsDefault = false;

    if ('is_default' in command && command.is_default === true) {
      for (const row of this.templates.values()) {
        if (row.tenant_id === tenantId && row.document_type === current.document_type && row.id !== templateId) {
          row.is_default = false;
        }
      }
    }

    const updated: StoredTemplate = {
      ...current,
      ...('name' in command && command.name !== undefined ? { name: command.name } : {}),
      is_default: nextIsDefault,
      is_active: nextIsActive,
      updated_at: new Date().toISOString(),
    };
    this.templates.set(templateId, updated);
    return this.toDetailDto(updated);
  }

  async remove(tenantId: TenantId, templateId: string): Promise<void> {
    const current = this.find(tenantId, templateId);
    if (!current) throw new DocumentPdfTemplateNotFoundError();
    this.templates.delete(templateId);
    this.placementsByTemplate.delete(templateId);
  }

  async issueUploadUrl(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateUploadTicketDto> {
    const current = this.find(tenantId, templateId);
    if (!current) throw new DocumentPdfTemplateNotFoundError();
    return this.issueTicketFor(templateId);
  }

  async confirmUpload(
    tenantId: TenantId,
    templateId: string,
    command: ConfirmDocumentPdfTemplateUploadCommand,
  ): Promise<DocumentPdfTemplateDetailDto> {
    const current = this.find(tenantId, templateId);
    if (!current) throw new DocumentPdfTemplateNotFoundError();

    const staged = this.stagedUploads.get(templateId);
    if (!staged) {
      throw new DocumentPdfTemplateUploadMissingError();
    }
    if (staged.kind === 'invalid') {
      this.stagedUploads.delete(templateId);
      throw new DocumentPdfTemplateInvalidPdfError('Fichier PDF illisible ou chiffre (simule pour test).');
    }

    // Completion D1 (§8.18 §9, 4b) : lines_block OU au moins un placement.
    const hasFieldMap = current.lines_block !== null || (this.placementsByTemplate.get(templateId)?.length ?? 0) > 0;
    const geometryChanged =
      current.status === 'ready' &&
      (current.page_count !== staged.pageCount || JSON.stringify(current.pages) !== JSON.stringify(staged.pages));

    if (geometryChanged && hasFieldMap && !command.reset_fields) {
      throw new DocumentPdfTemplateGeometryChangedError();
    }

    this.stagedUploads.delete(templateId);

    let updated: StoredTemplate = {
      ...current,
      status: 'ready',
      storage_path: `${tenantId}/${templateId}.pdf`,
      page_count: staged.pageCount,
      pages: staged.pages,
      byte_size: 12345,
      sha256: '0'.repeat(64),
      lines_block: geometryChanged && command.reset_fields ? null : current.lines_block,
      updated_at: new Date().toISOString(),
    };

    // Meme decision que la migration SQL (4b) : reset_fields vide aussi les
    // placements, pas seulement lines_block — une carte a moitie fausse
    // n est jamais acceptee.
    if (geometryChanged && command.reset_fields) {
      this.placementsByTemplate.delete(templateId);
    }

    if (updated.requested_default) {
      for (const row of this.templates.values()) {
        if (row.tenant_id === tenantId && row.document_type === updated.document_type && row.id !== templateId) {
          row.is_default = false;
        }
      }
      updated = { ...updated, is_default: true, requested_default: false };
    }

    this.templates.set(templateId, updated);
    return this.toDetailDto(updated);
  }

  /** E10.10b-4b — `GET .../fields`. */
  async getFields(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateFieldMapDto | null> {
    const current = this.find(tenantId, templateId);
    if (!current) return null;
    return {
      template_id: templateId,
      placements: [...(this.placementsByTemplate.get(templateId) ?? [])],
      lines_block: (current.lines_block as DocumentPdfTemplateFieldMapDto['lines_block']) ?? null,
    };
  }

  /** E10.10b-4b — `PUT .../fields`. Reimplemente FIDELEMENT le 409 upload_required tenu par `api_replace_document_pdf_template_fields`. */
  async replaceFields(
    tenantId: TenantId,
    templateId: string,
    command: ReplaceDocumentPdfTemplateFieldsCommand,
  ): Promise<DocumentPdfTemplateFieldMapDto> {
    const current = this.find(tenantId, templateId);
    if (!current) throw new DocumentPdfTemplateNotFoundError();
    if (current.status !== 'ready') throw new DocumentPdfTemplateUploadRequiredError();

    this.placementsByTemplate.set(templateId, [...command.placements]);
    this.templates.set(templateId, {
      ...current,
      lines_block: command.lines_block as StoredTemplate['lines_block'],
      updated_at: new Date().toISOString(),
    });

    return {
      template_id: templateId,
      placements: [...command.placements],
      lines_block: command.lines_block,
    };
  }

  private find(tenantId: TenantId, templateId: string): StoredTemplate | null {
    const row = this.templates.get(templateId);
    return row && row.tenant_id === tenantId ? row : null;
  }

  private issueTicketFor(templateId: string): DocumentPdfTemplateUploadTicketDto {
    this.ticketCounter += 1;
    return {
      url: `https://storage.test/document_pdf_templates/upload/${templateId}/${this.ticketCounter}`,
      token: `fake-upload-token-${this.ticketCounter}`,
      path: `fake-tenant/${templateId}.pdf`,
      content_type: 'application/pdf',
      max_byte_size: 10 * 1024 * 1024,
      expires_at: new Date(Date.now() + 7200_000).toISOString(),
    };
  }

  private toDetailDto(row: StoredTemplate): DocumentPdfTemplateDetailDto {
    const hasFieldMap = row.lines_block !== null || (this.placementsByTemplate.get(row.id)?.length ?? 0) > 0;
    return {
      id: row.id,
      document_type: row.document_type,
      name: row.name,
      status: row.status,
      is_default: row.is_default,
      is_active: row.is_active,
      page_count: row.page_count,
      byte_size: row.byte_size,
      created_at: row.created_at,
      updated_at: row.updated_at,
      pages: row.pages,
      sha256: row.sha256,
      has_field_map: hasFieldMap,
      background_url: row.status === 'ready' ? `https://storage.test/document_pdf_templates/${row.id}.pdf` : null,
      background_url_expires_at: row.status === 'ready' ? new Date(Date.now() + 900_000).toISOString() : null,
    };
  }
}

function toSummaryDto(row: StoredTemplate): DocumentPdfTemplateDto {
  return {
    id: row.id,
    document_type: row.document_type,
    name: row.name,
    status: row.status,
    is_default: row.is_default,
    is_active: row.is_active,
    page_count: row.page_count,
    byte_size: row.byte_size,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

