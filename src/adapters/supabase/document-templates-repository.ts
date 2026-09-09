/**
 * Implementation Supabase du referentiel des gabarits PDF de documents
 * (story E10.10b-4a).
 *
 * DEUX clients distincts, jamais confondus :
 *  - `client` — cle publique + JWT de l appelant (identique aux autres
 *    adaptateurs E10) : porte les lectures RLS (`document_pdf_templates_select`,
 *    ouverte a tout membre) et les appels aux quatre fonctions `security
 *    definer` (`api_create_document_pdf_template`, etc.), qui reevaluent
 *    `can_manage_document_templates` elles-memes via `auth.uid()`.
 *  - `storageClient` — `service_role` : SEUL role qui atteint le bucket prive
 *    `document_pdf_templates` (aucune policy `storage.objects`, contrat §8.18
 *    §2). Verifie par execution reelle contre Supabase Storage local
 *    (docker, `supabase_storage_magritoff-v5`) au moment de cette story :
 *    ticket d import + `fetch(url, {method:'PUT'})` NU + telechargement
 *    service_role + `createSignedUrl` de lecture + refus d un role `anon`
 *    direct — voir le rapport de fin de story pour le detail des mesures.
 *
 * pdf-lib N EST PAS importe ICI : `confirmUpload()` delegue l inspection du
 * fichier a `pdf-template-inspector.ts` (module pur, aucune dependance a
 * Supabase), pour que la logique d ouverture/mesure du PDF reste testable
 * sans base ni stockage.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
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
  type EligibleDocumentPdfTemplate,
  type ListDocumentPdfTemplatesFilters,
  type DocumentTemplatesRepository,
} from '../../modules/document-templates/application/document-templates-repository.ts';
import {
  inspectPdfTemplate,
  InvalidPdfTemplateError,
} from '../../modules/document-templates/application/pdf-template-inspector.ts';

const BUCKET = 'document_pdf_templates';
/** Contrat §8.18 §2 : plafond du bucket, redonne dans le billet d import. */
const MAX_UPLOAD_BYTE_SIZE = 10 * 1024 * 1024;
/** Arbitrage Arnaud du 2026-09-09 (reserve (c)), FIGE au contrat (`background_url_expires_at`). */
const BACKGROUND_URL_TTL_SECONDS = 900;
/**
 * Duree du billet d IMPORT — PAS fixee par l arbitrage (c), qui ne couvre que
 * le telechargement (300 s) et la lecture du fond dans l editeur (900 s).
 * `createSignedUploadUrl()` de `@supabase/storage-js@2.104.1` n accepte AUCUN
 * parametre de duree (verifie sur le code source du client, §8.18 §0 point 4) :
 * c est le SERVICE Storage qui la determine. Verifie par appel REEL contre
 * Supabase Storage local (docker) au moment de cette story : le jeton emis
 * est un JWT dont le `exp` vaut trouve+7200s. `decodeSignedUploadTicketExpiry()`
 * lit CETTE valeur reelle a chaque emission plutot que de la supposer figee :
 * cette constante n est qu un REPLI si le jeton ne se decode pas (format
 * inattendu), jamais la valeur utilisee en fonctionnement normal.
 */
const UPLOAD_TICKET_FALLBACK_TTL_SECONDS = 7200;

const TEMPLATE_COLUMNS =
  'id, document_type, name, status, storage_path, byte_size, sha256, page_count, pages, lines_block, is_default, is_active, created_at, updated_at';

/** E10.10b-4b — colonnes d un placement (`document_pdf_template_fields`). */
const FIELD_COLUMNS = 'field, page_index, x, y, width, max_lines, align, font, font_size, color';

export class SupabaseDocumentTemplatesRepository implements DocumentTemplatesRepository {
  constructor(
    private readonly client: SupabaseClient<any>,
    private readonly storageClient: SupabaseClient<any>,
  ) {}

  async list(
    tenantId: TenantId,
    filters: ListDocumentPdfTemplatesFilters,
  ): Promise<readonly DocumentPdfTemplateDto[]> {
    let query = this.client
      .from('document_pdf_templates')
      .select(TEMPLATE_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });
    if (filters.documentType !== null) query = query.eq('document_type', filters.documentType);
    if (filters.status !== null) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(toTemplateDto);
  }

  async findById(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateDetailDto | null> {
    const row = await this.selectRow(tenantId, templateId);
    if (!row) return null;
    return this.toDetailDto(tenantId, row);
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateDocumentPdfTemplateCommand,
  ): Promise<DocumentPdfTemplateCreatedDto> {
    void actor; // trace : la fonction lit auth.uid() de la session, pas ce parametre.
    const { data, error } = await this.client.rpc('api_create_document_pdf_template', {
      p_tenant_id: tenantId,
      p_document_type: command.document_type ?? null,
      p_name: command.name,
      p_requested_default: command.is_default,
    });
    if (error) throw mapDocumentTemplateError(error);

    const template = await this.toDetailDto(tenantId, data);
    const upload = await this.issueTicket(tenantId, data.id);
    return { template, upload };
  }

  async update(
    tenantId: TenantId,
    templateId: string,
    command: UpdateDocumentPdfTemplateCommand,
  ): Promise<DocumentPdfTemplateDetailDto> {
    const { data, error } = await this.client.rpc('api_update_document_pdf_template', {
      p_tenant_id: tenantId,
      p_template_id: templateId,
      p_has_name: 'name' in command,
      p_name: command.name ?? null,
      p_has_is_default: 'is_default' in command,
      p_is_default: command.is_default ?? null,
      p_has_is_active: 'is_active' in command,
      p_is_active: command.is_active ?? null,
    });
    if (error) throw mapDocumentTemplateError(error);
    return this.toDetailDto(tenantId, data);
  }

  async remove(tenantId: TenantId, templateId: string): Promise<void> {
    // L EXISTENCE est verifiee AVANT l appel RPC (la ligne n existe plus une
    // fois la suppression reussie) — mais le CHEMIN de stockage n est JAMAIS
    // lu depuis la ligne (`row.storage_path`) : il est RECALCULE depuis
    // `tenantId`/`templateId`, authentifies par le jeton de l appelant et le
    // parametre de route, jamais depuis une valeur de colonne qu un appel
    // direct (PostgREST/RPC forge) pourrait avoir fait pointer ailleurs
    // (qa-review B1 — voir aussi la contrainte CHECK ajoutee en base et
    // `api_confirm_document_pdf_template_upload`, qui ne recoit plus le
    // chemin en parametre pour la meme raison).
    const before = await this.selectRow(tenantId, templateId);

    const { error } = await this.client.rpc('api_delete_document_pdf_template', {
      p_tenant_id: tenantId,
      p_template_id: templateId,
    });
    if (error) throw mapDocumentTemplateError(error);

    if (before) {
      await this.storageClient.storage.from(BUCKET).remove([storagePathFor(tenantId, templateId)]);
    }
  }

  async issueUploadUrl(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateUploadTicketDto> {
    const row = await this.selectRow(tenantId, templateId);
    if (!row) throw new DocumentPdfTemplateNotFoundError();
    return this.issueTicket(tenantId, templateId);
  }

  async confirmUpload(
    tenantId: TenantId,
    templateId: string,
    command: ConfirmDocumentPdfTemplateUploadCommand,
  ): Promise<DocumentPdfTemplateDetailDto> {
    const row = await this.selectRow(tenantId, templateId);
    if (!row) throw new DocumentPdfTemplateNotFoundError();

    const storagePath = storagePathFor(tenantId, templateId);
    const { data: downloaded, error: downloadError } = await this.storageClient.storage
      .from(BUCKET)
      .download(storagePath);
    if (downloadError || !downloaded) {
      throw new DocumentPdfTemplateUploadMissingError(
        `Aucun fichier depose au chemin ${storagePath} (${downloadError?.message ?? 'objet absent'}).`,
      );
    }

    const bytes = new Uint8Array(await downloaded.arrayBuffer());

    let inspection;
    try {
      inspection = await inspectPdfTemplate(bytes);
    } catch (cause) {
      // Un fichier refuse ne reste pas (contrat §8.18, `confirmDocumentPdfTemplateUpload`
      // 422) : retire de bout en bout AVANT de rendre l erreur.
      await this.storageClient.storage.from(BUCKET).remove([storagePath]);
      if (cause instanceof InvalidPdfTemplateError) {
        throw new DocumentPdfTemplateInvalidPdfError(cause.message);
      }
      throw cause;
    }

    const sha256 = await sha256Hex(bytes);

    // `p_storage_path` N EST PLUS PASSE (qa-review B1) : la fonction SQL
    // recalcule elle-meme le chemin canonique depuis `p_tenant_id`/
    // `p_template_id`, jamais depuis une valeur fournie par l appelant —
    // meme motif que le retrait de `row.storage_path` ci-dessus.
    const { data, error } = await this.client.rpc('api_confirm_document_pdf_template_upload', {
      p_tenant_id: tenantId,
      p_template_id: templateId,
      p_page_count: inspection.pageCount,
      p_pages: inspection.pages,
      p_byte_size: bytes.length,
      p_sha256: sha256,
      p_reset_fields: command.reset_fields,
    });
    if (error) throw mapDocumentTemplateError(error);

    return this.toDetailDto(tenantId, data);
  }

  /**
   * E10.10b-4b — `GET .../fields`. `null` uniquement si le gabarit n existe
   * pas dans le tenant (404 cote route) : une carte vide (`placements: []`,
   * `lines_block: null`) est un etat LEGITIME, jamais confondu avec l absence
   * du gabarit lui-meme.
   */
  async getFields(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateFieldMapDto | null> {
    const row = await this.selectRow(tenantId, templateId);
    if (!row) return null;
    return this.toFieldMapDto(tenantId, templateId, row.lines_block ?? null);
  }

  /**
   * E10.10b-4b — `PUT .../fields`. Delegue le REMPLACEMENT INTEGRAL a
   * `api_replace_document_pdf_template_fields` (security definer, verrouille,
   * 409 `upload_required` si le gabarit n est pas `ready`), puis relit la
   * carte persistee (meme discipline que `create()`/`confirmUpload()` : la
   * fonction SQL fait foi, la lecture qui suit ne fait que la RENDRE, jamais
   * la recalculer).
   */
  async replaceFields(
    tenantId: TenantId,
    templateId: string,
    command: ReplaceDocumentPdfTemplateFieldsCommand,
  ): Promise<DocumentPdfTemplateFieldMapDto> {
    const { error } = await this.client.rpc('api_replace_document_pdf_template_fields', {
      p_tenant_id: tenantId,
      p_template_id: templateId,
      p_placements: command.placements,
      p_lines_block: command.lines_block,
    });
    if (error) throw mapDocumentTemplateError(error);

    return this.toFieldMapDto(tenantId, templateId, command.lines_block);
  }

  /**
   * E10.10b-4c/E10.19a — resout le gabarit qu utiliserait une generation
   * (condition d attachement a QUATRE termes, contrat §8.18 §5) :
   * `document_type = documentType`, `status = 'ready'`, `is_active`,
   * `is_default`, carte non vide. `is_default` etant unique par
   * `(tenant_id, document_type)` (index partiel, migration 20260909020000),
   * au plus UNE ligne peut jamais correspondre — `maybeSingle()` est donc
   * exact, pas une simplification. `documentType` est desormais un PARAMETRE
   * (E10.19a §0) : plus de `.eq('document_type', 'quote')` code en dur.
   */
  async findEligibleTemplateForGeneration(
    tenantId: TenantId,
    documentType: DocumentType,
  ): Promise<EligibleDocumentPdfTemplate | null> {
    const { data, error } = await this.client
      .from('document_pdf_templates')
      .select(TEMPLATE_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('document_type', documentType)
      .eq('status', 'ready')
      .eq('is_active', true)
      .eq('is_default', true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    const hasFieldMap = await this.templateHasFieldMap(tenantId, data.id, data.lines_block ?? null);
    if (!hasFieldMap) return null;

    const storagePath = storagePathFor(tenantId, data.id);
    const { data: downloaded, error: downloadError } = await this.storageClient.storage
      .from(BUCKET)
      .download(storagePath);
    if (downloadError || !downloaded) {
      // qa-review B3 (BLOQUANT, corrige) : la version precedente traitait
      // TOUTE erreur de telechargement — objet reellement absent COMME une
      // panne reseau transitoire ou un 5xx du service Storage — comme "aucun
      // gabarit eligible", donc un repli SILENCIEUX vers l envoi sans piece
      // jointe. C est exactement le repli que la regle (j) interdit : un
      // gabarit ETAIT eligible, la production a echoue pour une raison qui
      // n a rien a voir avec le gabarit lui-meme, et l envoi doit echouer en
      // 500 `quote.document_generation_failed`, pas repartir en silence.
      //
      // SEULE cause traitee comme "pas de gabarit" : un 404 EXPLICITE du
      // service Storage (`statusCode === '404'`, verifie par execution
      // reelle contre Supabase Storage local — `StorageApiError { status:
      // 400, statusCode: '404', message: 'Object not found' }`), defense en
      // profondeur pour le cas — qui ne devrait jamais se produire,
      // `confirmUpload` etant le SEUL endroit qui pose `status = 'ready'`
      // apres avoir relu le fichier avec succes — d un gabarit `ready` sans
      // fichier au chemin attendu. TOUTE AUTRE cause (reseau, timeout, 5xx,
      // erreur inconnue) est LEVEE.
      const statusCode = (downloadError as { statusCode?: string } | null)?.statusCode;
      if (statusCode === '404') return null;
      throw new Error(
        `Telechargement du fond du gabarit eligible impossible (${data.id}) : ${downloadError?.message ?? 'objet absent'}`,
      );
    }
    const backgroundBytes = new Uint8Array(await downloaded.arrayBuffer());

    const { data: fieldRows, error: fieldsError } = await this.client
      .from('document_pdf_template_fields')
      .select(FIELD_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('template_id', data.id);
    if (fieldsError) throw new Error(fieldsError.message);

    return {
      templateId: data.id,
      backgroundBytes,
      pages: toPagesDto(data.pages),
      placements: (fieldRows ?? []).map(toPlacementDto),
      linesBlock: data.lines_block ?? null,
    };
  }

  /** Assemble `DocumentPdfTemplateFieldMap` a partir des placements PERSISTES (relus), jamais de la commande recue. */
  private async toFieldMapDto(
    tenantId: TenantId,
    templateId: string,
    linesBlock: DocumentPdfTemplateFieldMapDto['lines_block'],
  ): Promise<DocumentPdfTemplateFieldMapDto> {
    const { data, error } = await this.client
      .from('document_pdf_template_fields')
      .select(FIELD_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('template_id', templateId);
    if (error) throw new Error(error.message);

    return {
      template_id: templateId,
      placements: (data ?? []).map(toPlacementDto),
      lines_block: linesBlock,
    };
  }

  /** `has_field_map` (D1, §8.18 §9) : `lines_block` OU au moins un placement PERSISTE. */
  private async templateHasFieldMap(
    tenantId: TenantId,
    templateId: string,
    linesBlock: unknown,
  ): Promise<boolean> {
    if (linesBlock !== null && linesBlock !== undefined) return true;
    const { data, error } = await this.client
      .from('document_pdf_template_fields')
      .select('field')
      .eq('tenant_id', tenantId)
      .eq('template_id', templateId)
      .limit(1);
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  }

  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    void actorId; // trace : `user_has_capability` lit `auth.uid()` de la session, pas ce parametre.
    const { data, error } = await this.client.rpc('user_has_capability', {
      p_tenant_id: tenantId,
      p_capability: capability,
    });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  private async selectRow(tenantId: TenantId, templateId: string): Promise<Record<string, any> | null> {
    const { data, error } = await this.client
      .from('document_pdf_templates')
      .select(TEMPLATE_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', templateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  }

  private async issueTicket(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateUploadTicketDto> {
    const path = storagePathFor(tenantId, templateId);
    const { data, error } = await this.storageClient.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: true });
    if (error || !data) throw new Error(error?.message ?? 'Emission du billet d import impossible.');

    return {
      url: data.signedUrl,
      token: data.token,
      path: data.path,
      content_type: 'application/pdf',
      max_byte_size: MAX_UPLOAD_BYTE_SIZE,
      expires_at: decodeSignedUploadTicketExpiry(data.token),
    };
  }

  /**
   * `background_url` (900 s) : emise APRES verification d appartenance,
   * jamais avant (contrat). Le chemin signe est TOUJOURS `storagePathFor(tenantId,
   * row.id)`, JAMAIS `row.storage_path` (qa-review B1) : une valeur de
   * colonne, meme lue par un SELECT garde par la RLS, reste une DONNEE — un
   * appel direct (PostgREST/RPC forge) ayant reussi a y ecrire un chemin
   * d un AUTRE tenant signerait alors le fichier de cet autre tenant. Le
   * chemin canonique ne depend que de `tenantId` (resolu du jeton par la
   * facade, jamais de l URL) et de l identifiant de la ressource — aucune
   * des deux valeurs n est controlable par l appelant au-dela de ce que la
   * RLS/le service ont deja verifie.
   */
  private async toDetailDto(
    tenantId: TenantId,
    row: Record<string, any>,
  ): Promise<DocumentPdfTemplateDetailDto> {
    // D1 (§8.18 §9, complete par E10.10b-4b) : lines_block OU au moins un
    // placement PERSISTE — un OU, pas un ET, les deux etant independants.
    const hasFieldMap = await this.templateHasFieldMap(tenantId, row.id, row.lines_block);
    let backgroundUrl: string | null = null;
    let backgroundUrlExpiresAt: string | null = null;

    if (row.status === 'ready') {
      const path = storagePathFor(tenantId, row.id);
      const { data, error } = await this.storageClient.storage
        .from(BUCKET)
        .createSignedUrl(path, BACKGROUND_URL_TTL_SECONDS);
      if (!error && data) {
        backgroundUrl = data.signedUrl;
        backgroundUrlExpiresAt = new Date(Date.now() + BACKGROUND_URL_TTL_SECONDS * 1000).toISOString();
      }
    }

    return {
      id: row.id,
      document_type: row.document_type,
      name: row.name,
      status: row.status,
      is_default: Boolean(row.is_default),
      is_active: Boolean(row.is_active),
      page_count: row.page_count ?? null,
      byte_size: row.byte_size === null || row.byte_size === undefined ? null : Number(row.byte_size),
      created_at: toIsoTimestamp(row.created_at),
      updated_at: toIsoTimestamp(row.updated_at),
      pages: toPagesDto(row.pages),
      sha256: row.sha256 ?? null,
      has_field_map: hasFieldMap,
      background_url: backgroundUrl,
      background_url_expires_at: backgroundUrlExpiresAt,
    };
  }
}

function storagePathFor(tenantId: TenantId, templateId: string): string {
  return `${tenantId}/${templateId}.pdf`;
}

function toTemplateDto(row: Record<string, any>): DocumentPdfTemplateDto {
  return {
    id: row.id,
    document_type: row.document_type,
    name: row.name,
    status: row.status,
    is_default: Boolean(row.is_default),
    is_active: Boolean(row.is_active),
    page_count: row.page_count ?? null,
    byte_size: row.byte_size === null || row.byte_size === undefined ? null : Number(row.byte_size),
    created_at: toIsoTimestamp(row.created_at),
    updated_at: toIsoTimestamp(row.updated_at),
  };
}

/**
 * `numeric` Postgres est rendu en chaine par `@supabase/supabase-js` (meme
 * constat que `position`/`quantity` ailleurs dans le depot, ex.
 * `commercial-orders-repository.ts`) : conversion EXPLICITE, jamais une
 * comparaison ou une addition sur la chaine brute.
 */
function toPlacementDto(row: Record<string, any>): DocumentFieldPlacementDto {
  return {
    field: row.field,
    page_index: Number(row.page_index),
    x: Number(row.x),
    y: Number(row.y),
    width: row.width === null || row.width === undefined ? null : Number(row.width),
    max_lines: Number(row.max_lines),
    align: row.align,
    font: row.font,
    font_size: Number(row.font_size),
    color: row.color,
  };
}

function toPagesDto(raw: unknown): DocumentPdfTemplatePageDto[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((page) => ({
    index: Number(page.index),
    width_pt: Number(page.width_pt),
    height_pt: Number(page.height_pt),
  }));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Lit le `exp` REEL du jeton de depot (JWT emis par Supabase Storage,
 * verifie par appel local — voir en-tete de fichier), plutot que de supposer
 * une duree fixe. Repli sur `UPLOAD_TICKET_FALLBACK_TTL_SECONDS` si le jeton
 * ne se decode pas comme un JWT (format inattendu d une version future de
 * Storage) : ne doit JAMAIS faire echouer l emission d un billet pour un motif
 * accessoire a l import lui-meme.
 */
function decodeSignedUploadTicketExpiry(token: string): string {
  try {
    const segments = token.split('.');
    const payloadSegment = segments[1];
    if (!payloadSegment) throw new Error('jeton sans segment de charge utile');
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') throw new Error('jeton sans exp');
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return new Date(Date.now() + UPLOAD_TICKET_FALLBACK_TTL_SECONDS * 1000).toISOString();
  }
}

/**
 * Traduit une erreur Postgres (message d exception `raise exception 'code: detail'`
 * d une fonction `api_*`) en erreur de domaine. Meme discipline que
 * `mapProductionStepError` (E10.13).
 */
function mapDocumentTemplateError(error: { code?: string; message: string }): Error {
  const message = error.message ?? '';

  if (message.includes('permission_denied')) {
    // La route retraduit ce cas en 403 identity.role_required via le SERVICE
    // (`assertCanManageDocumentTemplates`, appele AVANT toute ecriture) :
    // cette branche n est normalement jamais atteinte, defense en profondeur.
    return new Error(`permission_denied: ${message}`);
  }
  if (message.includes('document_pdf_template.limit_reached')) {
    return new DocumentPdfTemplateLimitReachedError(message);
  }
  if (message.includes('document_pdf_template.name_conflict')) {
    return new DocumentPdfTemplateNameConflictError(message);
  }
  if (message.includes('document_pdf_template.default_requires_ready')) {
    return new DocumentPdfTemplateDefaultRequiresReadyError(message);
  }
  if (message.includes('document_pdf_template.geometry_changed')) {
    return new DocumentPdfTemplateGeometryChangedError(message);
  }
  if (message.includes('document_pdf_template.in_use')) {
    return new DocumentPdfTemplateInUseError(message);
  }
  if (message.includes('document_pdf_template.upload_required')) {
    return new DocumentPdfTemplateUploadRequiredError(message);
  }
  if (message.includes('document_pdf_template.not_found')) {
    return new DocumentPdfTemplateNotFoundError(message);
  }
  if (error.code === '23505') {
    // E10.10b-4b : `document_pdf_template_fields_unique_field` (un champ
    // place deux fois) ne PEUT etre atteinte que si le SERVICE n a pas
    // valide en amont (chemin nominal) — traduite en 422 invalid_field_map
    // plutot qu en 409 name_conflict, code qui n a de sens que pour
    // document_pdf_templates.
    if (message.includes('document_pdf_template_fields_unique_field')) {
      return new DocumentPdfTemplateInvalidFieldMapError([
        { field: 'placements', message: 'Un champ est place plus d une fois sur ce gabarit.' },
      ]);
    }
    return new DocumentPdfTemplateNameConflictError(message);
  }
  if (error.code === '23503') {
    return new DocumentPdfTemplateInUseError(message);
  }
  if (error.code === '23514') {
    // Violation d une contrainte CHECK de document_pdf_template_fields
    // (borne, enum, format couleur) : defense en profondeur si un appel RPC
    // direct contournait la validation applicative (le chemin nominal, le
    // SERVICE, ne l atteint jamais).
    return new DocumentPdfTemplateInvalidFieldMapError([
      { field: 'placements', message: message || 'Valeur de champ hors des bornes autorisees.' },
    ]);
  }
  return new Error(message || 'Operation impossible sur le referentiel des gabarits PDF.');
}
