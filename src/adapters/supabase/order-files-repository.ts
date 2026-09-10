/**
 * Implementation Supabase du referentiel des fichiers de commande
 * (story E10.17a).
 *
 * DEUX clients distincts, jamais confondus — meme discipline qu
 * `document-templates-repository.ts` (E10.10b-4a) :
 *  - `client` — cle publique + JWT de l appelant : porte les lectures RLS
 *    (`commercial_order_files_select`, ouverte a tout membre du tenant) et
 *    les appels aux trois fonctions `security definer` (`api_confirm_order_
 *    file_upload`, etc.), qui reevaluent l appartenance au tenant elles-memes
 *    via `auth.uid()`.
 *  - `storageClient` — `service_role` : SEUL role qui atteint le bucket prive
 *    `commercial_order_files` (aucune policy `storage.objects`, contrat
 *    §8.19 §3). Peut etre le MEME client `service_role` que celui deja
 *    construit pour `document_pdf_templates` (aucune specificite de bucket
 *    sur le client lui-meme) : reutilise par la composition, pas reconstruit.
 *
 * LE CHEMIN DE STOCKAGE N EST JAMAIS LU DEPUIS UNE COLONNE ET JAMAIS ENVOYE A
 * UNE FONCTION SQL EN PARAMETRE (lecon qa-review B1, E10.10b-4a) : il est
 * TOUJOURS recalcule ici depuis `tenantId`/`orderId`/`fileId`, authentifies
 * par le jeton de l appelant et les parametres de route — jamais depuis
 * `row.storage_path`, qui reste une DONNEE meme lue par un SELECT garde par
 * la RLS.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type {
  ConfirmOrderFileUploadCommand,
  OrderFileDetailDto,
  OrderFileDto,
  OrderFileUploadTicketDto,
  UpdateOrderFileCommand,
} from '../../modules/order-files/api/contracts.ts';
import {
  OrderFileAlreadyConfirmedError,
  OrderFileLimitReachedError,
  OrderFileLineNotFoundError,
  OrderFileNotFoundError,
  OrderFileRejectedError,
  OrderFileUploadExpiredError,
  OrderFileUploadMissingError,
  OrderNotFoundError,
  type ListOrderFilesResult,
  type OrderFilesRepository,
} from '../../modules/order-files/application/order-files-repository.ts';

/**
 * EXPORTEE (E10.20b) : `SupabaseOrderUploadLinksRepository` reutilise le
 * MEME bucket pour le billet/la confirmation par lien — un second canal de
 * stockage pour le meme objet serait une duplication sans motif (contrat
 * §8.21 §0 : "commercial_order_files (E10.17a) est REUTILISE tel quel par
 * E10.20b — ce lot ne depose rien [de nouveau]").
 */
export const BUCKET = 'commercial_order_files';
/**
 * Contrat §8.19 §3 : 50 Mo, plafond du PROJET (`supabase/config.toml`),
 * PERIMETRE du lot (decision (a)). EXPORTEE : E10.20a (`order-upload-links-
 * repository.ts`) annonce la MEME limite dans `OrderUploadLinkContext.
 * max_byte_size` — arbitrage (A) du 2026-09-10, contrat §"story E10.20" —
 * une seconde constante aurait pu diverger silencieusement de celle-ci.
 */
export const MAX_UPLOAD_BYTE_SIZE = 50 * 1024 * 1024;
/**
 * Contrat §8.19 : sept types, DEUX pour l archive ZIP (le systeme du
 * deposant determine celui pose par le navigateur). EXPORTEE pour la meme
 * raison que `MAX_UPLOAD_BYTE_SIZE` : E10.20a annonce la MEME liste dans
 * `OrderUploadLinkContext.accepted_content_types`.
 */
export const ACCEPTED_CONTENT_TYPES: readonly string[] = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/zip',
  'application/x-zip-compressed',
]);
/**
 * Contrat §8.19 decision (b) : 30 fichiers VIVANTS par commande, PARTAGE
 * entre les deux voies d entree (atelier E10.17a, lien public E10.20b — meme
 * verrou consultatif SQL, `api_confirm_order_file_upload_by_link`).
 * EXPORTEE (qa-review round 1, N5 — cette valeur existait en plusieurs
 * exemplaires disperses, risque de divergence silencieuse) : `order-upload-
 * links-repository.ts` la REUTILISE telle quelle plutot que de la dupliquer
 * sous un second nom. Cote SQL, la MEME valeur reste un litteral dans les
 * DEUX fonctions `security definer` (`api_confirm_order_file_upload`,
 * `api_confirm_order_file_upload_by_link`) : Postgres n a pas de constante
 * partageable entre fonctions aussi simplement qu un module TypeScript, et
 * toucher la fonction 17a deja livree est hors perimetre de ce correctif.
 */
export const ORDER_FILE_LIVE_LIMIT = 30;
/** Arbitrage Arnaud du 2026-09-09 : 300 s, meme valeur que `QuoteDocument.download_url_expires_at`. */
const DOWNLOAD_URL_TTL_SECONDS = 300;
/**
 * `createSignedUploadUrl()` de `@supabase/storage-js@2.104.1` n accepte AUCUN
 * parametre de duree (meme constat qu E10.10b-4a, §8.18 §0 point 4) : c est
 * le service Storage qui la determine (JWT dont l `exp` est decode
 * reellement par `decodeSignedUploadTicketExpiry`). Repli seulement si le
 * jeton ne se decode pas comme un JWT.
 */
const UPLOAD_TICKET_FALLBACK_TTL_SECONDS = 7200;

// `storage_path` est DELIBEREMENT ABSENT de cette selection (qa-review N4) :
// le chemin est TOUJOURS recalcule (`storagePathFor`), jamais lu d une
// colonne — la colonne existe en base mais rien dans ce fichier n a le droit
// de la consommer, autant ne pas la lire du tout.
// `deposited_via` (E10.20b) rejoint la selection : servie desormais sur TOUS
// les fichiers, atelier compris (contrat §8.21 §8bis, "20b le sert sur TOUS
// les fichiers, y compris workspace").
// `purge_at` (E10.22a) rejoint la selection : servie sur TOUS les fichiers
// (la colonne est NOT NULL en base depuis la migration 20260910000500),
// TOUJOURS transmise TELLE QUELLE (toIsoTimestamp) -- jamais recalculee ici,
// c est precisement l interdiction du contrat (« figee au depot »).
const FILE_COLUMNS =
  'id, order_id, order_line_id, filename, content_type, byte_size, visibility, deposited_by, deposited_by_label, deposited_via, deposited_at, purge_at, updated_at, deleted_at';

export class SupabaseOrderFilesRepository implements OrderFilesRepository {
  constructor(
    private readonly client: SupabaseClient<any>,
    private readonly storageClient: SupabaseClient<any>,
  ) {}

  async listByOrder(tenantId: TenantId, orderId: string): Promise<ListOrderFilesResult | null> {
    const orderExists = await this.orderExists(tenantId, orderId);
    if (!orderExists) return null;

    const { data, error } = await this.client
      .from('commercial_order_files')
      .select(FILE_COLUMNS)
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .order('deposited_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toFileDto);
  }

  async findById(tenantId: TenantId, orderId: string, fileId: string): Promise<OrderFileDetailDto | null> {
    // DEUX etapes, pas une jointure PostgREST : l appartenance au tenant est
    // verifiee sur `commercial_orders` (qui la porte), puis le fichier est lu
    // sur `order_id` seul — sa propre cle etrangere garantit deja qu il ne
    // peut appartenir qu a CETTE commande.
    if (!(await this.orderExists(tenantId, orderId))) return null;

    const { data, error } = await this.client
      .from('commercial_order_files')
      .select(FILE_COLUMNS)
      .eq('order_id', orderId)
      .eq('id', fileId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.toDetailDto(tenantId, data);
  }

  /** qa-review N6 : meme resolution que `findById`, SANS signer d URL — voir le port. */
  async findRawById(tenantId: TenantId, orderId: string, fileId: string): Promise<OrderFileDto | null> {
    if (!(await this.orderExists(tenantId, orderId))) return null;

    const { data, error } = await this.client
      .from('commercial_order_files')
      .select(FILE_COLUMNS)
      .eq('order_id', orderId)
      .eq('id', fileId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return toFileDto(data);
  }

  async issueUploadUrl(tenantId: TenantId, orderId: string): Promise<OrderFileUploadTicketDto> {
    if (!(await this.orderExists(tenantId, orderId))) throw new OrderNotFoundError();

    // Verifie le plafond PAR COURTOISIE (contrat : "refuser tot evite de
    // faire televerser [le fichier] pour rien" — la barriere qui COMPTE est
    // celle d`api_confirm_order_file_upload`, prise SOUS VERROU). Une course
    // entre deux billets emis dans le meme instant peut laisser passer 31
    // fichiers jusqu a la confirmation : acceptable, la fonction SQL refusera
    // alors le 31e a la confirmation.
    const { count, error: countError } = await this.client
      .from('commercial_order_files')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId)
      .is('deleted_at', null);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) >= ORDER_FILE_LIVE_LIMIT) throw new OrderFileLimitReachedError();

    const fileId = crypto.randomUUID();
    const path = storagePathFor(tenantId, orderId, fileId);
    // `upsert: false` (correctif securite Arnaud, 2026-09-10, dette M3 qa-review
    // E10.20b) : un chemin de stockage n est JAMAIS re-ecrit — `fileId` est
    // NEUF a chaque billet (ligne ci-dessus), donc chaque billet cible deja un
    // chemin UNIQUE. Le seul effet reel d `upsert: true` etait de permettre a
    // un SECOND `PUT` sur LE MEME billet (le meme signed URL, valide ~2h) de
    // remplacer un contenu DEJA CONFIRME — le porteur d un lien ou d une
    // requete rejouee ne doit jamais pouvoir ecraser un fichier deja depose,
    // confirme ou non. "Remplacer" n existe pas dans le produit : on supprime
    // (`api_delete_order_file`) puis on redemande un billet NEUF si besoin.
    const { data, error } = await this.storageClient.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data) throw new Error(error?.message ?? 'Emission du billet de depot impossible.');

    return {
      file_id: fileId,
      url: data.signedUrl,
      token: data.token,
      path: data.path,
      max_byte_size: MAX_UPLOAD_BYTE_SIZE,
      accepted_content_types: [...ACCEPTED_CONTENT_TYPES],
      expires_at: decodeSignedUploadTicketExpiry(data.token),
    };
  }

  async confirmUpload(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: ConfirmOrderFileUploadCommand,
  ): Promise<OrderFileDto> {
    void actor; // trace : la fonction SQL lit auth.uid() de la session, pas ce parametre.
    if (!(await this.orderExists(tenantId, orderId))) throw new OrderNotFoundError();

    // Chemin RECALCULE, jamais recu du client (leçon qa-review B1,
    // E10.10b-4a) : les seuls elements qui le composent sont le tenant du
    // jeton, la commande du chemin, et le file_id alloue par le billet.
    const storagePath = storagePathFor(tenantId, orderId, command.file_id);

    // Relit la METADONNEE de l objet (`info(path)`), SANS transferer les
    // octets (decision #7 du contrat) : c est ce qui rend la confirmation bon
    // marche a 50 Mo.
    const { data: info, error: infoError } = await this.storageClient.storage.from(BUCKET).info(storagePath);
    if (infoError || !info) {
      throw new OrderFileUploadMissingError(
        `Aucun fichier depose au chemin ${storagePath} (${infoError?.message ?? 'objet absent'}).`,
      );
    }

    const byteSize = info.size ?? 0;
    const contentType = info.contentType ?? '';

    // Defense en profondeur (le bucket refuse deja ces cas au `PUT` — cette
    // branche ne devrait normalement jamais s executer sur le chemin
    // nominal) : un objet hors plafond ou hors liste ne reste pas, retire
    // avant de rendre l erreur, meme discipline que
    // `confirmDocumentPdfTemplateUpload` sur un PDF illisible.
    if (byteSize < 1 || byteSize > MAX_UPLOAD_BYTE_SIZE || !ACCEPTED_CONTENT_TYPES.includes(contentType)) {
      await this.storageClient.storage.from(BUCKET).remove([storagePath]);
      throw new OrderFileRejectedError(
        `Objet depose refuse (taille ${byteSize} octet(s), type ${contentType || 'inconnu'}).`,
      );
    }

    const { data, error } = await this.client.rpc('api_confirm_order_file_upload', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_file_id: command.file_id,
      p_filename: command.filename,
      p_order_line_id: command.order_line_id ?? null,
      p_visibility: command.visibility ?? 'internal',
      p_content_type: contentType,
      p_byte_size: byteSize,
    });
    if (error) throw mapOrderFileError(error);

    return toFileDto(data);
  }

  async updateVisibility(
    tenantId: TenantId,
    orderId: string,
    fileId: string,
    command: UpdateOrderFileCommand,
  ): Promise<OrderFileDto> {
    const { data, error } = await this.client.rpc('api_update_order_file_visibility', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_file_id: fileId,
      p_visibility: command.visibility,
    });
    if (error) throw mapOrderFileError(error);
    return toFileDto(data);
  }

  async remove(tenantId: TenantId, orderId: string, fileId: string, actor: UserId): Promise<void> {
    void actor; // trace : la fonction SQL lit auth.uid() de la session, pas ce parametre.

    // ORDRE PRESCRIT PAR LE CONTRAT, NON INTERCHANGEABLE : la LIGNE d abord
    // (transactionnel, `api_delete_order_file`), l objet de stockage ENSUITE
    // (best-effort). Echouer avant le retrait de l objet est encore gratuit ;
    // echouer apres ne l est plus (§8.19 §3, "echouer tant qu echouer est
    // encore gratuit, jamais apres le point de non-retour").
    const { data, error } = await this.client.rpc('api_delete_order_file', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_file_id: fileId,
    });
    if (error) throw mapOrderFileError(error);

    const storagePath = storagePathFor(tenantId, orderId, fileId);
    const { error: removeError } = await this.storageClient.storage.from(BUCKET).remove([storagePath]);
    if (removeError) {
      // L echec du retrait est JOURNALISE, jamais rendu a l appelant HTTP
      // (contrat) : la suppression a bien eu lieu du point de vue de tout ce
      // que Magrit lit (la ligne est marquee supprimee, INCONDITIONNELLEMENT
      // dans ce cas). Un objet residuel dans un bucket PRIVE, SANS policy,
      // reste inerte — meme dette bornee que §8.18 #11 (E10.10b-4a).
      console.error(
        `[order-files] retrait de l objet de stockage echoue apres suppression de la ligne (${storagePath})`,
        removeError,
      );
    }
    void data;
  }

  private async orderExists(tenantId: TenantId, orderId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('commercial_orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data !== null;
  }

  /**
   * `download_url` (300 s) FORCE le telechargement (`download=<filename>`,
   * decision #6 du contrat) : contrepartie du fait que le type MIME est
   * declare par le deposant et non prouve. Le chemin signe est TOUJOURS
   * `storagePathFor(tenantId, orderId, row.id)`, JAMAIS `row.storage_path`
   * (qa-review B1, E10.10b-4a) : une valeur de colonne reste une DONNEE,
   * meme lue par un SELECT garde par la RLS. `tenantId` est celui deja
   * verifie par l appelant (`orderExists`), jamais relu d une colonne
   * (cette table n en porte pas).
   */
  private async toDetailDto(tenantId: TenantId, row: Record<string, any>): Promise<OrderFileDetailDto> {
    const path = storagePathFor(tenantId, row.order_id, row.id);
    const { data, error } = await this.storageClient.storage
      .from(BUCKET)
      .createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS, { download: row.filename as string });
    if (error || !data) throw new Error(error?.message ?? 'Emission de l URL de telechargement impossible.');

    return {
      id: row.id,
      order_id: row.order_id,
      order_line_id: row.order_line_id ?? null,
      filename: row.filename,
      content_type: row.content_type,
      byte_size: Number(row.byte_size),
      visibility: row.visibility,
      deposited_at: toIsoTimestamp(row.deposited_at),
      deposited_by: row.deposited_by ?? null,
      deposited_by_label: row.deposited_by_label ?? null,
      deposited_via: row.deposited_via ?? 'workspace',
      purge_at: row.purge_at ? toIsoTimestamp(row.purge_at) : undefined,
      updated_at: toIsoTimestamp(row.updated_at),
      download_url: data.signedUrl,
      download_url_expires_at: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }
}

/**
 * `<tenant_id>/<order_id>/<file_id>`, SANS extension (contrat §8.19 §3) —
 * TOUJOURS recalcule, jamais lu d une colonne. EXPORTEE (E10.20b) : le billet
 * du lien public reforme le MEME chemin depuis le tenant RESOLU du lien
 * (jamais recu en parametre), meme discipline, une seule fonction.
 */
export function storagePathFor(tenantId: TenantId, orderId: string, fileId: string): string {
  return `${tenantId}/${orderId}/${fileId}`;
}

function toFileDto(row: Record<string, any>): OrderFileDto {
  return {
    id: row.id,
    order_id: row.order_id,
    order_line_id: row.order_line_id ?? null,
    filename: row.filename,
    content_type: row.content_type,
    byte_size: Number(row.byte_size),
    visibility: row.visibility,
    deposited_at: toIsoTimestamp(row.deposited_at),
    deposited_by: row.deposited_by ?? null,
    deposited_by_label: row.deposited_by_label ?? null,
    deposited_via: row.deposited_via ?? 'workspace',
    purge_at: row.purge_at ? toIsoTimestamp(row.purge_at) : undefined,
    updated_at: toIsoTimestamp(row.updated_at),
  };
}

/**
 * Lit le `exp` REEL du jeton de depot (JWT emis par Supabase Storage), plutot
 * que de supposer une duree fixe — meme fonction qu `E10.10b-4a`
 * (`decodeSignedUploadTicketExpiry`, document-templates-repository.ts),
 * reprise a l identique.
 */
export function decodeSignedUploadTicketExpiry(token: string): string {
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
 * `mapDocumentTemplateError` (E10.10b-4a).
 */
function mapOrderFileError(error: { code?: string; message: string }): Error {
  const message = error.message ?? '';

  if (message.includes('permission_denied')) {
    // Chemin nominal : tout membre du tenant est autorise (decision #4).
    // Cette branche ne devrait normalement jamais s executer — defense en
    // profondeur si l appartenance au tenant venait a manquer.
    return new Error(`permission_denied: ${message}`);
  }
  if (message.includes('order.not_found')) {
    return new OrderNotFoundError(message);
  }
  if (message.includes('order_file.already_confirmed')) {
    return new OrderFileAlreadyConfirmedError(message);
  }
  if (message.includes('order_file.upload_expired')) {
    // qa-review round 1 (B2, BLOQUANT GRAVE, E10.22b/c) : l objet storage
    // est deja plus vieux que le delai des orphelins au moment de la
    // confirmation -- refuse par la fonction SQL (20260910000700), jamais
    // par ce seul adaptateur.
    return new OrderFileUploadExpiredError(message);
  }
  if (message.includes('order_file.limit_reached')) {
    return new OrderFileLimitReachedError(message);
  }
  if (message.includes('order_file.line_not_found')) {
    return new OrderFileLineNotFoundError(message);
  }
  if (message.includes('order_file.not_found')) {
    return new OrderFileNotFoundError(message);
  }
  if (error.code === '23503') {
    return new OrderFileLineNotFoundError(message);
  }
  return new Error(message || 'Operation impossible sur le referentiel des fichiers de commande.');
}
