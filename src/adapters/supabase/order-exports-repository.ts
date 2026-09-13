/**
 * Implementation Supabase du module Exports de commandes (story E10.18c).
 *
 * QUATRE classes (qa-review round 3, 2026-09-13 : balayage d objets
 * orphelins AJOUTE, point 3(e) du contrat), QUATRE usages, jamais confondus
 * — meme discipline que `SupabaseOrderDocumentsRepository` (E10.19b) :
 *  - `SupabaseOrderExportsRepository` — FACADE HTTP (`authenticated`, JWT de
 *    l acteur). Sert les trois operations `/commercial-order-exports*` :
 *    `api_request_order_export` RESOUT `auth.uid()`, elle EXIGE ce client ;
 *    la lecture (`list`/`findById`) passe par la policy RLS
 *    `commercial_order_exports_select` (garde-fou EN BASE, defense en
 *    profondeur du controle applicatif `OrderExportsService`).
 *  - `SupabaseOrderExportRunRepository` — DRAIN DE GENERATION
 *    (`service_role`). Sert `magrit-order-export-runner` : reclamation
 *    (`api_claim_order_exports`), lecture des lignes GARDEE
 *    (`api_read_order_export_rows`, JAMAIS un `from()` sur une vue
 *    `private` — voir la migration `20260913000000` pour le detail complet
 *    de cette garde), et ecriture directe des colonnes de suivi (grant
 *    colonne a `service_role`, meme patron que `notification_logs`).
 *  - `SupabaseOrderExportPurgeRepository` — PURGE DE RETENTION, ETAGE 1
 *    (`service_role`). Sert l Edge Function `magrit-order-file-purge`
 *    (E10.22b, ETENDUE) : reclamation+marquage SQL
 *    (`api_claim_order_exports_for_purge`) PUIS retrait REEL des objets
 *    Storage par lot, best-effort, confirmation CIBLEE (round 3) — voir ce
 *    port pour la regle opposable complete et l historique des deux
 *    corrections.
 *  - `SupabaseOrderExportOrphanRepository` — PURGE DE RETENTION, ETAGE 2,
 *    SOLUTION PORTEUSE (`service_role`, round 3) : balayage independant du
 *    bucket `order_exports` (`api_claim_orphan_order_export_objects`), qui
 *    rattrape ce que l etage 1 n a pas confirme retire.
 *
 * `storageClient` (`service_role`) est PARTAGE par les deux premieres
 * classes pour l URL signee de telechargement : le bucket `order_exports` ne
 * porte AUCUNE policy `storage.objects`, seul `service_role` l atteint.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';
import type { OrderExportDto, OrderExportFiltersDto } from '../../modules/order-exports/api/contracts.ts';
import type { OrderExportRawRow } from '../../modules/order-exports/application/order-export-columns.ts';
import {
  OrderExportAccessDeniedError,
  OrderExportPendingLimitReachedError,
  type ListOrderExportsFilters,
  type OrderExportsRepository,
  type RequestOrderExportParams,
} from '../../modules/order-exports/application/order-exports-repository.ts';
import type {
  ClaimedOrderExport,
  MarkOrderExportReadyParams,
  OrderExportRowsPage,
  OrderExportRunRepository,
  OrderExportRunSettings,
} from '../../modules/order-exports/application/order-export-run-repository.ts';
import type {
  OrderExportOrphanRepository,
  OrderExportPurgeRepository,
  OrderExportPurgeSummary,
} from '../../modules/order-exports/application/order-export-purge-repository.ts';

const TABLE = 'commercial_order_exports';
const BUCKET = 'order_exports';
/** Meme valeur et meme motif que `QuoteDocument`/`OrderDocument.download_url_expires_at`. */
const DOWNLOAD_URL_TTL_SECONDS = 300;

const ROW_COLUMNS =
  'id, status, format, granularity, filters, layout_version, requested_by, requested_by_label, requested_at, started_at, completed_at, row_count, storage_path, file_name, byte_size, sha256, content_type, expires_at, attempts, error_code, error_detail';

export class SupabaseOrderExportsRepository implements OrderExportsRepository {
  constructor(
    /** JETON DE L ACTEUR (`authenticated`) — OBLIGATOIRE pour `api_request_order_export`. */
    private readonly client: SupabaseClient<any>,
    /** `service_role` — URL signee UNIQUEMENT, jamais la table. */
    private readonly storageClient: SupabaseClient<any>,
  ) {}

  async actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean> {
    void actorId; // trace : `user_has_capability` lit `auth.uid()` de la session, pas ce parametre.
    const { data, error } = await this.client.rpc('user_has_capability', {
      p_tenant_id: tenantId,
      p_capability: capability,
    });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  async list(
    tenantId: TenantId,
    actor: UserId,
    filters: ListOrderExportsFilters,
  ): Promise<readonly OrderExportDto[]> {
    let query = this.client
      .from(TABLE)
      .select(ROW_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('requested_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(filters.size + 1);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.format) query = query.eq('format', filters.format);
    if (filters.granularity) query = query.eq('granularity', filters.granularity);
    if (filters.cursor) {
      query = query.or(
        `requested_at.lt.${filters.cursor.sort},and(requested_at.eq.${filters.cursor.sort},id.lt.${filters.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(`Lecture du registre des exports impossible: ${error.message}`);
    return Promise.all((data ?? []).map((row) => this.toDto(row, actor)));
  }

  async request(
    tenantId: TenantId,
    actor: UserId,
    params: RequestOrderExportParams,
  ): Promise<OrderExportDto> {
    void actor; // trace : requested_by/requested_by_label sont resolus par la RPC depuis auth.uid(), jamais depuis ce parametre.
    const { data, error } = await this.client.rpc('api_request_order_export', {
      p_tenant_id: tenantId,
      p_format: params.format,
      p_granularity: params.granularity,
      p_filters: params.filters,
    });
    if (error) throw mapRequestOrderExportError(error.message);

    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown>);
    if (!row) throw new Error('api_request_order_export n a rendu aucune ligne.');
    return this.toDto(row, actor);
  }

  async findById(tenantId: TenantId, actor: UserId, exportId: string): Promise<OrderExportDto | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select(ROW_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', exportId)
      .maybeSingle();
    if (error) throw new Error(`Lecture de l export ${exportId} impossible: ${error.message}`);
    if (!data) return null;
    return this.toDto(data, actor);
  }

  /**
   * `download_url` reserve au DEMANDEUR (contrat) et au SEUL statut `ready`
   * — dans les deux autres cas, `null`, JAMAIS un 403 (le demandeur reste
   * visible, seul le lien disparait).
   */
  private async toDto(row: Record<string, any>, actor: UserId): Promise<OrderExportDto> {
    const isOwnerReady = row.status === 'ready' && row.requested_by === actor && typeof row.storage_path === 'string';
    let downloadUrl: string | null = null;
    let downloadUrlExpiresAt: string | null = null;
    if (isOwnerReady) {
      const { data: signed, error } = await this.storageClient.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, DOWNLOAD_URL_TTL_SECONDS);
      if (!error && signed) {
        downloadUrl = signed.signedUrl;
        downloadUrlExpiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString();
      }
      // Une signature en echec ne doit pas casser la lecture de l export :
      // le statut/row_count restent lisibles, seul le lien manque (rare —
      // objet purge entre-temps par exemple).
    }

    return {
      id: row.id,
      status: row.status,
      format: row.format,
      granularity: row.granularity,
      filters: (row.filters ?? {}) as OrderExportFiltersDto,
      layout_version: row.layout_version,
      requested_by: row.requested_by ?? null,
      requested_by_label: row.requested_by_label ?? null,
      requested_at: toIsoTimestamp(row.requested_at),
      started_at: toIsoTimestampOrNull(row.started_at),
      completed_at: toIsoTimestampOrNull(row.completed_at),
      row_count: row.row_count ?? null,
      file_name: row.file_name ?? null,
      byte_size: row.byte_size ?? null,
      sha256: row.sha256 ?? null,
      content_type: row.content_type ?? null,
      download_url: downloadUrl,
      download_url_expires_at: downloadUrlExpiresAt,
      expires_at: toIsoTimestampOrNull(row.expires_at),
      attempts: row.attempts,
      error_code: row.error_code ?? null,
      error_detail: row.error_detail ?? null,
    };
  }
}

/** ORDRE identique a la fonction SQL (authentication_required -> permission_denied -> pending_limit_reached), meme discipline que `mapRegisterOrderDocumentError`. */
function mapRequestOrderExportError(message: string): Error {
  if (message.includes('order_export.pending_limit_reached')) {
    return new OrderExportPendingLimitReachedError(message);
  }
  if (message.includes('permission_denied')) {
    return new OrderExportAccessDeniedError(message);
  }
  if (message.includes('authentication_required')) {
    return new Error(`authentication_required: ${message}`);
  }
  return new Error(`Demande d export impossible: ${message}`);
}

export class SupabaseOrderExportRunRepository implements OrderExportRunRepository {
  constructor(private readonly serviceRoleClient: SupabaseClient<any>) {}

  async claim(settings: OrderExportRunSettings): Promise<readonly ClaimedOrderExport[]> {
    const { data, error } = await this.serviceRoleClient.rpc('api_claim_order_exports', {
      p_limit: settings.limit,
      p_max_attempts: settings.maxAttempts,
      p_max_age: `${settings.maxAgeSeconds} seconds`,
    });
    if (error) throw new Error(`Reclamation des exports impossible: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      tenantId: row.tenant_id as TenantId,
      format: row.format as ClaimedOrderExport['format'],
      granularity: row.granularity as ClaimedOrderExport['granularity'],
      filters: (row.filters ?? {}) as OrderExportFiltersDto,
    }));
  }

  async readRows(exportId: string, after: unknown | null, limit: number): Promise<OrderExportRowsPage> {
    const { data, error } = await this.serviceRoleClient.rpc('api_read_order_export_rows', {
      p_export_id: exportId,
      p_after: after,
      p_limit: limit,
    });
    if (error) throw new Error(`Lecture des lignes de l export ${exportId} impossible: ${error.message}`);
    // `payload` (nom de colonne SQL) : `row` est un identifiant RESERVE cote
    // Postgres (`returns table(cursor jsonb, row jsonb)` echoue au parsing —
    // corrige en base, voir migration 20260913000000).
    const records = (data ?? []) as Array<{ cursor: unknown; payload: OrderExportRawRow }>;
    const last = records[records.length - 1];
    return {
      rows: records.map((record) => record.payload),
      nextAfter: records.length < limit ? null : (last?.cursor ?? null),
    };
  }

  async markReady(id: string, params: MarkOrderExportReadyParams): Promise<void> {
    const { error } = await this.serviceRoleClient
      .from(TABLE)
      .update({
        status: 'ready',
        row_count: params.rowCount,
        storage_path: params.storagePath,
        file_name: params.fileName,
        byte_size: params.byteSize,
        sha256: params.sha256,
        content_type: params.contentType,
        completed_at: params.completedAt,
        expires_at: params.expiresAt,
        error_code: null,
        error_detail: null,
      })
      .eq('id', id);
    if (error) throw new Error(`Marquage 'ready' de l export ${id} impossible: ${error.message}`);
  }

  async markFailed(id: string, code: string, detail: string, completedAt: string): Promise<void> {
    const { error } = await this.serviceRoleClient
      .from(TABLE)
      .update({
        status: 'failed',
        error_code: code,
        error_detail: detail.slice(0, 2000),
        completed_at: completedAt,
      })
      .eq('id', id);
    if (error) throw new Error(`Marquage 'failed' de l export ${id} impossible: ${error.message}`);
  }
}

/**
 * Deduit, du RETOUR de `storage.remove(paths)`, l ensemble des chemins pour
 * lesquels le SERVEUR affirme avoir supprime la ligne `storage.objects`
 * correspondante — jamais une preuve que l objet BINAIRE a disparu (voir
 * le port pour le fait etabli sur les erreurs S3 par cle et le filtrage
 * RLS). C est la MEILLEURE APPROXIMATION DISPONIBLE, utilisee UNIQUEMENT
 * pour decider QUELS ids confirmer — jamais pour decider qu un chemin
 * ABSENT de `data` a echoue (il peut simplement etre invisible par RLS).
 */
function removedPathsFrom(data: unknown): ReadonlySet<string> {
  const rows = (data ?? []) as readonly Readonly<{ name?: unknown }>[];
  return new Set(rows.map((row) => row.name).filter((name): name is string => typeof name === 'string'));
}

/**
 * E10.18c, qa-review round 1 PUIS round 2 PUIS round 3 (point 3(e) du
 * contrat, CORRIGE deux fois — voir le port pour l historique complet).
 * `client` = `service_role` — MEME discipline que
 * `SupabaseOrderFilePurgeExecutionRepository` (E10.22b,
 * `order-file-purge-repository.ts`, sur le bucket DISTINCT
 * `commercial_order_files`) : la LIGNE est marquee/maintenue D ABORD, en
 * SQL transactionnel (`api_claim_order_exports_for_purge`), l OBJET Storage
 * est retire ENSUITE, PAR LOT, best-effort.
 *
 * ⚠️ CORRECTION round 3 : confirmer TOUS les ids reclames des que
 * `remove()` rend `error: null` (round 2) ETAIT ENCORE FAUX pour un retrait
 * PARTIEL (HTTP 200, erreurs PAR CLE, AUCUNE erreur de lot) — voir le port
 * pour le fait etabli. La confirmation est desormais CIBLEE sur les SEULS
 * ids dont le chemin figure dans `data` ; les autres restent `expired` avec
 * `storage_path` non nul, RE-RECLAMABLES au tour suivant (jusqu au plafond
 * `purge_attempts`, puis rattrapes par `SupabaseOrderExportOrphanRepository`,
 * SOLUTION PORTEUSE).
 */
export class SupabaseOrderExportPurgeRepository implements OrderExportPurgeRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async purgeExpiredFiles(limit: number): Promise<OrderExportPurgeSummary> {
    const { data, error } = await this.client.rpc('api_claim_order_exports_for_purge', { p_limit: limit });
    if (error) throw new Error(`Reclamation des exports a purger impossible: ${error.message}`);
    const rows = (data ?? []) as readonly Readonly<{
      purged_export_id: string;
      purged_tenant_id: string;
      purged_storage_path: string;
    }>[];
    if (rows.length === 0) return { filesMarkedExpired: 0, objectsRemoved: 0 };

    const paths = rows.map((row) => row.purged_storage_path);
    const { data: removed, error: removeError } = await this.client.storage.from(BUCKET).remove(paths);
    if (removeError) {
      // AUCUNE confirmation : chaque ligne reste `expired` avec
      // `storage_path` NON NUL (jamais efface ici) — elle sera RE-RECLAMEE
      // au tour suivant par `api_claim_order_exports_for_purge`. `remove()`
      // sur un chemin deja retire est attendu IDEMPOTENT (comportement
      // standard d un backend compatible S3 : supprimer une cle absente est
      // un succes, pas une erreur) — non verifie par ce lot ; meme si cette
      // hypothese s averait fausse, le pire cas serait un `removeError`
      // renouvele et une nouvelle reprise, jamais une perte de trace.
      console.error('[order-exports] retrait par lot des fichiers d export expires echoue, reclamable au tour suivant', removeError);
      return { filesMarkedExpired: rows.length, objectsRemoved: 0 };
    }

    // CORRECTION round 3 — retrait SANS ERREUR DE LOT n est PAS retrait
    // TOTAL : `data` peut ne porter qu UNE PARTIE des chemins demandes
    // (erreurs S3 PAR CLE, HTTP 200). On ne confirme QUE les ids dont le
    // chemin figure REELLEMENT dans `data` (meilleure approximation
    // disponible, voir le port) — jamais tous les ids reclames en bloc :
    // c est EXACTEMENT le defaut ferme ici.
    const removedPaths = removedPathsFrom(removed);
    const confirmableIds = rows.filter((row) => removedPaths.has(row.purged_storage_path)).map((row) => row.purged_export_id);
    if (confirmableIds.length === 0) {
      // Retrait rendu SANS ERREUR mais AUCUN chemin reclame ne figure dans
      // `data` (backend qui rend systematiquement `data: []`, cf. le port) :
      // rien a confirmer, tout reste re-reclamable — PAS une erreur, un
      // constat.
      return { filesMarkedExpired: rows.length, objectsRemoved: 0 };
    }

    // `objectsRemoved` est DERIVE du nombre de lignes REELLEMENT mises a
    // jour par la confirmation (jamais de `rows.length` ni de
    // `confirmableIds.length` seuls : la confirmation peut elle-meme
    // echouer partiellement si une ligne a change d etat entre-temps).
    const { data: confirmedCount, error: confirmError } = await this.client.rpc(
      'api_confirm_order_export_files_purged',
      { p_export_ids: confirmableIds },
    );
    if (confirmError) {
      // Retrait Storage (partiellement) reussi mais confirmation EN BASE
      // echouee : storage_path reste non nul sur TOUTES les lignes -> elles
      // seront RE-RECLAMEES au tour suivant (retravail sur des objets deja
      // absents pour certains, sans risque de perte — voir hypothese
      // d idempotence ci-dessus).
      console.error('[order-exports] confirmation en base du retrait echouee, reclamable au tour suivant', confirmError);
      return { filesMarkedExpired: rows.length, objectsRemoved: 0 };
    }
    return { filesMarkedExpired: rows.length, objectsRemoved: Number(confirmedCount ?? 0) };
  }
}

/**
 * E10.18c, qa-review round 3 — SOLUTION PORTEUSE (arbitrage architecte),
 * PAS un complement au filtrage sur `data` de `SupabaseOrderExportPurgeRepository`.
 * Meme discipline que `SupabaseOrphanObjectRepository` (E10.22c,
 * `order-file-purge-repository.ts`) pour la categorie « jamais referencee »
 * (aucune ligne a marquer, le retrait suffit) ; AJOUTE la confirmation
 * (`api_confirm_order_export_files_purged`) pour la categorie « purge_attempts
 * epuise » (`matched_export_id` non nul), pour que l invariant se ferme
 * meme sur les lignes que la reclamation normale a abandonnees.
 */
export class SupabaseOrderExportOrphanRepository implements OrderExportOrphanRepository {
  constructor(private readonly client: SupabaseClient<any>) {}

  async removeOrphanObjects(olderThanHours: number, limit: number): Promise<number> {
    const { data, error } = await this.client.rpc('api_claim_orphan_order_export_objects', {
      p_older_than: `${olderThanHours} hours`,
      p_limit: limit,
    });
    if (error) throw new Error(`Reclamation des objets orphelins d export impossible: ${error.message}`);
    const rows = (data ?? []) as readonly Readonly<{
      orphan_object_id: string;
      orphan_object_path: string;
      matched_export_id: string | null;
    }>[];
    if (rows.length === 0) return 0;

    const { data: removed, error: removeError } = await this.client.storage
      .from(BUCKET)
      .remove(rows.map((row) => row.orphan_object_path));
    if (removeError) {
      // Meme discipline que SupabaseOrphanObjectRepository (E10.22c) : un
      // echec de retrait ne doit JAMAIS se lire comme un succes — rattrape
      // au tour suivant (categorie (a) : rien n a change ; categorie (b) :
      // la ligne reste expired/storage_path non nul/purge_attempts au
      // plafond, toujours candidate a ce meme balayage).
      console.error('[order-exports] retrait par lot des objets orphelins d export echoue', removeError);
      return 0;
    }

    // N1 (E10.22c) applique ici : le compte rendu DERIVE du resultat REEL
    // de `remove()` (meilleure approximation disponible, voir le port),
    // jamais de `rows.length`.
    const removedPaths = removedPathsFrom(removed);

    // Categorie (b) SEULEMENT (`matched_export_id` non nul) : ferme
    // l invariant de reprise pour les lignes a bout de tentatives
    // normales, EXACTEMENT comme le ferait une confirmation reussie a
    // l etage 1 — categorie (a) n a AUCUNE ligne a confirmer (jamais
    // referencee).
    const confirmableIds = rows
      .filter((row) => row.matched_export_id !== null && removedPaths.has(row.orphan_object_path))
      .map((row) => row.matched_export_id as string);
    if (confirmableIds.length > 0) {
      const { error: confirmError } = await this.client.rpc('api_confirm_order_export_files_purged', {
        p_export_ids: confirmableIds,
      });
      if (confirmError) {
        // La ligne reste expired/storage_path non nul : elle redeviendra
        // candidate au MEME balayage au tour suivant (categorie (b)),
        // aucune perte de trace.
        console.error('[order-exports] confirmation en base du retrait d objets orphelins echouee', confirmError);
      }
    }

    return removedPaths.size;
  }
}
