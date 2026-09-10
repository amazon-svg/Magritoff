/**
 * Implementation Supabase du referentiel des liens publics de depot
 * (stories E10.20a/E10.20b).
 *
 * TROIS clients distincts, jamais confondus — meme discipline qu
 * `SupabaseApiPrincipalVerifier`/`order-files-repository.ts` :
 *  - `client` — porte le JWT Magrit de l appelant (`Authorization` transmise
 *    par la facade). Les TROIS operations d atelier (`create`/`listByOrder`/
 *    `revoke`) l utilisent : leurs fonctions `security definer` lisent
 *    `auth.uid()` pour verifier l appartenance au tenant et signer l audit
 *    (`created_by`/`revoked_by`), exactement comme `api_confirm_order_file_
 *    upload` (E10.17a).
 *  - `anonClient` — SANS AUCUN JWT Magrit, meme raisonnement que
 *    `storefrontClient` (E10.10b-1) : le porteur d un lien de depot n a PAR
 *    CONSTRUCTION aucune credential Magrit. `getContext`, `issueFileUploadUrl`
 *    (via `resolveLinkForDeposit`) l utilisent — ce sont des LECTURES,
 *    `api_get_order_upload_link_context`/`api_resolve_order_upload_link_
 *    principal` restent GRANT `anon` (STABLE, sans effet de bord metier).
 *    Utiliser `client` ici ferait dependre la resolution du lien d un JWT
 *    que l appelant legitime n a jamais — et ferait fuiter, le cas echeant,
 *    le JWT d un membre qui ouvrirait le lien de son propre client dans le
 *    meme navigateur (§3.6 branche 4 : le cumul est refuse en AMONT par le
 *    middleware, mais ce repository ne doit de toute facon jamais avoir
 *    besoin de ce jeton pour resoudre un lien).
 *  - `storageClient` — `service_role` (E10.20b) : SEUL role qui atteint le
 *    bucket prive `commercial_order_files` (aucune policy `storage.objects`,
 *    REUTILISE tel quel depuis E10.17a — ce lot n en cree aucun second),
 *    lit PAR COURTOISIE et SANS RLS les DEUX plafonds avant d emettre un
 *    billet, et — qa-review round 1, B1, BLOQUANT SECURITE, corrige —
 *    APPELLE DESORMAIS `api_confirm_order_file_upload_by_link`, qui N EST
 *    PLUS GRANT `anon` (faille exploitee reellement : la fonction etait
 *    joignable par la cle anon PUBLIQUE, sans passer par cet adaptateur ni
 *    ses controles, et faisait confiance a des parametres de poids/type
 *    fournis par l appelant). La fonction RE-VERIFIE de toute facon l objet
 *    reel dans `storage.objects` (defense en profondeur), mais SEUL
 *    `service_role` (jamais expose au navigateur) peut desormais l appeler.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp, toIsoTimestampOrNull } from '../../modules/_shared/application/index.ts';
import type { OrderFileUploadTicketDto } from '../../modules/order-files/api/contracts.ts';
import {
  OrderFileAlreadyConfirmedError,
  OrderFileRejectedError,
  OrderFileUploadExpiredError,
  OrderFileUploadMissingError,
} from '../../modules/order-files/application/order-files-repository.ts';
import type {
  ConfirmOrderUploadLinkFileCommand,
  CreateOrderUploadLinkCommand,
  OrderUploadLinkContextDto,
  OrderUploadLinkCreatedDto,
  OrderUploadLinkDto,
} from '../../modules/order-upload-links/api/contracts.ts';
import {
  OrderNotFoundError,
  OrderUploadLinkFileLimitReachedError,
  OrderUploadLinkLimitReachedError,
  OrderUploadLinkNotFoundError,
  type ConfirmOrderUploadLinkFileResult,
  type ListOrderUploadLinksResult,
  type OrderUploadLinksRepository,
} from '../../modules/order-upload-links/application/order-upload-links-repository.ts';
// REUTILISES tels quels (pas de seconde constante) : le plafond de poids, la
// liste de types acceptes et le plafond de 30 fichiers vivants de ce lot
// sont IDENTIQUES a E10.17a — meme bucket de stockage, meme arbitrage (A) du
// 2026-09-10 ("on ne bouge pas"), meme budget PARTAGE (qa-review round 1,
// N5 : une seconde constante locale `ORDER_FILE_LIVE_LIMIT = 30` existait
// ici, risque de divergence silencieuse avec l original — retiree).
import {
  ACCEPTED_CONTENT_TYPES,
  BUCKET,
  decodeSignedUploadTicketExpiry,
  MAX_UPLOAD_BYTE_SIZE,
  ORDER_FILE_LIVE_LIMIT,
  storagePathFor,
} from './order-files-repository.ts';

// `token_hash`/`revoked_by`/`revoked_by_label` sont DELIBEREMENT absents de
// cette selection : le jeton n est jamais relu (une seule fois, a la
// creation), et un lien revoque ne fait plus partie des lectures "vivantes"
// de ce module — meme discipline que `storage_path` sur order-files.
const LINK_COLUMNS =
  'id, order_id, label, expires_at, max_files, deposited_count, use_count, first_used_at, last_used_at, created_at, created_by, created_by_label, revoked_at';

export class SupabaseOrderUploadLinksRepository implements OrderUploadLinksRepository {
  constructor(
    private readonly client: SupabaseClient<any>,
    private readonly anonClient: SupabaseClient<any>,
    private readonly storageClient: SupabaseClient<any>,
  ) {}

  async create(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: CreateOrderUploadLinkCommand,
  ): Promise<OrderUploadLinkCreatedDto> {
    void actor; // trace : la fonction SQL lit auth.uid() de la session, pas ce parametre.
    const { data, error } = await this.client.rpc('api_create_order_upload_link', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_label: command.label ?? null,
      p_expires_in_days: command.expires_in_days,
      p_max_files: command.max_files,
    });
    if (error) throw mapOrderUploadLinkError(error);
    const row = Array.isArray(data) ? data[0] : data;
    return toCreatedDto(row);
  }

  async listByOrder(tenantId: TenantId, orderId: string): Promise<ListOrderUploadLinksResult | null> {
    const orderExists = await this.orderExists(tenantId, orderId);
    if (!orderExists) return null;

    const { data, error } = await this.client
      .from('commercial_order_upload_links')
      .select(LINK_COLUMNS)
      .eq('order_id', orderId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toLinkDto);
  }

  async revoke(tenantId: TenantId, orderId: string, linkId: string, actor: UserId): Promise<void> {
    void actor; // trace : la fonction SQL lit auth.uid() de la session, pas ce parametre.
    const { error } = await this.client.rpc('api_revoke_order_upload_link', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_link_id: linkId,
    });
    if (error) throw mapOrderUploadLinkError(error);
  }

  async getContext(token: string): Promise<OrderUploadLinkContextDto | null> {
    const { data, error } = await this.anonClient.rpc('api_get_order_upload_link_context', {
      p_token: token,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    return {
      printer_name: row.printer_name,
      order_number: row.order_number,
      label: row.label ?? null,
      expires_at: toIsoTimestamp(row.expires_at),
      max_files: Number(row.max_files),
      deposited_count: Number(row.deposited_count),
      // Constantes APPLICATIVES, jamais lues de la fonction SQL : le bucket
      // et sa limite sont un fait de STOCKAGE, pas une donnee de ce lien —
      // meme raisonnement qu `issueOrderFileUploadUrl` (E10.17a).
      max_byte_size: MAX_UPLOAD_BYTE_SIZE,
      accepted_content_types: [...ACCEPTED_CONTENT_TYPES],
    };
  }

  /**
   * E10.20b — `issueOrderUploadLinkFileUrl`. PATRON EXACT d
   * `OrderFilesRepository.issueUploadUrl` (E10.17a) : ALLOUE un `file_id` et
   * SIGNE l URL, AUCUNE ligne creee. Les DEUX plafonds (lien, commande) sont
   * verifies ICI PAR COURTOISIE, SOUS `storageClient` (service_role, bypass
   * RLS — ce repository n a AUCUN JWT membre a disposition) : la barriere
   * qui COMPTE reste `api_confirm_order_file_upload_by_link`, prise SOUS
   * VERROU a la confirmation.
   */
  async issueFileUploadUrl(token: string): Promise<OrderFileUploadTicketDto> {
    const resolved = await this.resolveLinkForDeposit(token);
    if (!resolved) throw new OrderUploadLinkNotFoundError();

    const [fileCount, linkBudget] = await Promise.all([
      this.storageClient
        .from('commercial_order_files')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', resolved.orderId)
        .is('deleted_at', null),
      this.storageClient
        .from('commercial_order_upload_links')
        .select('max_files, deposited_count')
        .eq('id', resolved.linkId)
        .maybeSingle(),
    ]);
    if (fileCount.error) throw new Error(fileCount.error.message);
    if (linkBudget.error) throw new Error(linkBudget.error.message);
    if ((fileCount.count ?? 0) >= ORDER_FILE_LIVE_LIMIT) {
      throw new OrderUploadLinkFileLimitReachedError();
    }
    if (
      linkBudget.data &&
      Number(linkBudget.data.deposited_count) >= Number(linkBudget.data.max_files)
    ) {
      throw new OrderUploadLinkFileLimitReachedError();
    }

    const fileId = crypto.randomUUID();
    const path = storagePathFor(resolved.tenantId as TenantId, resolved.orderId, fileId);
    // `upsert: false` — MEME correctif, MEME raisonnement qu
    // `order-files-repository.ts#issueUploadUrl` (correctif securite Arnaud,
    // 2026-09-10, dette M3 qa-review E10.20b) : le porteur d un lien public,
    // par construction anonyme et moins de confiance que l atelier, ne doit
    // JAMAIS pouvoir re-ecrire le contenu d un fichier deja depose via le
    // MEME billet (le meme signed URL, valide ~2h) apres confirmation.
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

  /**
   * E10.20b — `confirmOrderUploadLinkFile`. Relit la METADONNEE de l objet
   * depose (`info(path)`, sans transferer les octets — meme decision #7
   * qu E10.17a) comme premiere passe RAPIDE et CONVIVIALE (message d erreur
   * precis, retrait best-effort d un objet refuse), puis appelle
   * `api_confirm_order_file_upload_by_link` — SECONDE fonction de
   * confirmation, DISTINCTE d `api_confirm_order_file_upload` (contrat
   * §8.21 §0 : gardes opposees, jamais factorisees).
   *
   * qa-review round 1, B1 (BLOQUANT SECURITE, corrige) — cette verification
   * cote adaptateur N EST PLUS LA SEULE : la fonction SQL RE-VERIFIE
   * elle-meme l objet reel dans `storage.objects` avant d ecrire quoi que ce
   * soit (defense en profondeur reelle, pas seulement documentee). La faille
   * initiale tenait au CUMUL de deux faits — cette RPC etait GRANT `anon` ET
   * faisait confiance a des parametres `p_content_type`/`p_byte_size`
   * fournis par l appelant — qui rendait ce controle cote adaptateur
   * CONTOURNABLE par un appel direct a la RPC avec la cle anon publique.
   * Desormais GRANT `service_role` uniquement (voir plus bas) : ce controle
   * cote adaptateur redevient un CONFORT (message d erreur rapide, sans
   * attendre l aller-retour SQL), la garde qui COMPTE est dans la fonction.
   *
   * Le chemin de stockage est RECALCULE depuis le TENANT RESOLU DU LIEN
   * (jamais recu en parametre, jamais lu d une colonne fournie par
   * l appelant).
   */
  async confirmFileUpload(
    token: string,
    command: ConfirmOrderUploadLinkFileCommand,
  ): Promise<ConfirmOrderUploadLinkFileResult> {
    const resolved = await this.resolveLinkForDeposit(token);
    if (!resolved) throw new OrderUploadLinkNotFoundError();

    const storagePath = storagePathFor(resolved.tenantId as TenantId, resolved.orderId, command.file_id);

    const { data: info, error: infoError } = await this.storageClient.storage.from(BUCKET).info(storagePath);
    if (infoError || !info) {
      throw new OrderFileUploadMissingError(
        `Aucun fichier depose au chemin ${storagePath} (${infoError?.message ?? 'objet absent'}).`,
      );
    }

    const byteSize = info.size ?? 0;
    const contentType = info.contentType ?? '';

    // Defense en profondeur (le bucket refuse deja ces cas au `PUT`, meme
    // discipline qu E10.17a) : un objet hors plafond ou hors liste ne reste
    // pas, retire avant de rendre l erreur.
    if (byteSize < 1 || byteSize > MAX_UPLOAD_BYTE_SIZE || !ACCEPTED_CONTENT_TYPES.includes(contentType)) {
      await this.storageClient.storage.from(BUCKET).remove([storagePath]);
      throw new OrderFileRejectedError(
        `Objet depose refuse (taille ${byteSize} octet(s), type ${contentType || 'inconnu'}).`,
      );
    }

    // qa-review round 1, B1 (BLOQUANT SECURITE, corrige) — cette RPC est
    // desormais GRANT EXECUTE `service_role` UNIQUEMENT (plus `anon`) : elle
    // n est plus joignable par la cle publique du navigateur, meme munie
    // d un jeton de lien legitime. Appelee ICI via `storageClient` (le MEME
    // client service_role deja utilise pour le stockage), jamais
    // `anonClient`. `p_content_type`/`p_byte_size` NE SONT PLUS transmis :
    // la fonction les RELIT elle-meme depuis `storage.objects` (defense en
    // profondeur reelle, la garde qui compte desormais) — ce que ce
    // repository envoyait ici n a plus voix au chapitre pour ce qui est
    // ecrit en base.
    //
    // RE-VERIFIE le jeton une SECONDE fois, a l interieur de la fonction SQL
    // elle-meme (TOCTOU entre le billet et la confirmation, ou entre la
    // resolution ci-dessus et cet appel) : `upload_link.invalid` si le lien
    // n est plus vivant a cet instant precis, SOUS VERROU.
    const { data, error } = await this.storageClient.rpc('api_confirm_order_file_upload_by_link', {
      p_token: token,
      p_file_id: command.file_id,
      p_filename: command.filename,
    });
    if (error) throw mapOrderUploadLinkFileError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new OrderUploadLinkNotFoundError();

    return {
      deposit: {
        file_id: row.file_id,
        filename: row.filename,
        content_type: row.content_type,
        byte_size: Number(row.byte_size),
        deposited_at: toIsoTimestamp(row.deposited_at),
        deposited_count: Number(row.deposited_count),
        max_files: Number(row.max_files),
      },
      tenantId: row.tenant_id as TenantId,
      uploadLinkId: row.upload_link_id,
      orderId: row.order_id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
    };
  }

  /**
   * TEST/USAGE INTERNE — resout `link_id`/`order_id`/`tenant_id` depuis le
   * jeton via `api_resolve_order_upload_link_principal` (STABLE, SANS effet
   * de bord, GRANT `anon` — MEME fonction que celle deja consommee par
   * `SupabaseApiPrincipalVerifier`, E10.20a). Reutilisee ICI pour reformer le
   * chemin de stockage sans jamais faire confiance a un `orderId`/`tenantId`
   * de principal deja resolu transmis en clair.
   */
  private async resolveLinkForDeposit(
    token: string,
  ): Promise<Readonly<{ linkId: string; orderId: string; tenantId: string }> | null> {
    const { data, error } = await this.anonClient.rpc('api_resolve_order_upload_link_principal', {
      p_token: token,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return { linkId: row.link_id, orderId: row.order_id, tenantId: row.tenant_id };
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
}

function toLinkDto(row: Record<string, any>): OrderUploadLinkDto {
  return {
    id: row.id,
    order_id: row.order_id,
    label: row.label ?? null,
    expires_at: toIsoTimestamp(row.expires_at),
    max_files: Number(row.max_files),
    deposited_count: Number(row.deposited_count),
    use_count: Number(row.use_count),
    first_used_at: toIsoTimestampOrNull(row.first_used_at),
    last_used_at: toIsoTimestampOrNull(row.last_used_at),
    created_at: toIsoTimestamp(row.created_at),
    created_by: row.created_by ?? null,
    created_by_label: row.created_by_label ?? null,
  };
}

function toCreatedDto(row: Record<string, any>): OrderUploadLinkCreatedDto {
  return { ...toLinkDto(row), token: row.token };
}

/**
 * Traduit une erreur Postgres (message d exception `raise exception 'code: detail'`
 * d une fonction `api_*`) en erreur de domaine. Meme discipline que
 * `mapOrderFileError` (E10.17a).
 */
function mapOrderUploadLinkError(error: { code?: string; message: string }): Error {
  const message = error.message ?? '';

  if (message.includes('order.not_found')) {
    return new OrderNotFoundError(message);
  }
  if (message.includes('upload_link.limit_reached')) {
    return new OrderUploadLinkLimitReachedError(message);
  }
  if (message.includes('upload_link.not_found')) {
    return new OrderUploadLinkNotFoundError(message);
  }
  if (message.includes('permission_denied')) {
    return new Error(`permission_denied: ${message}`);
  }
  return new Error(message || 'Operation impossible sur le referentiel des liens de depot.');
}

/**
 * Traduit une erreur Postgres d `api_confirm_order_file_upload_by_link`
 * (E10.20b) — DISTINCTE de `mapOrderUploadLinkError` : cette fonction ne
 * leve jamais `permission_denied` (son unique garde d identite est le
 * jeton, deja re-verifie), mais reutilise LES MEMES codes `order_file.*`
 * qu `api_confirm_order_file_upload` (E10.17a) pour les cas qu elle
 * partage. `order_file.upload_missing`/`order_file.rejected` (qa-review
 * round 1, B1) sont desormais aussi leves par la fonction SQL elle-meme
 * (defense en profondeur reelle, pas seulement par le controle cote
 * adaptateur qui les leve normalement avant d atteindre la RPC).
 */
function mapOrderUploadLinkFileError(error: { code?: string; message: string }): Error {
  const message = error.message ?? '';

  if (message.includes('upload_link.invalid')) {
    return new OrderUploadLinkNotFoundError(message);
  }
  if (message.includes('upload_link.file_limit_reached')) {
    return new OrderUploadLinkFileLimitReachedError(message);
  }
  if (message.includes('order_file.already_confirmed')) {
    return new OrderFileAlreadyConfirmedError(message);
  }
  if (message.includes('order_file.upload_missing')) {
    return new OrderFileUploadMissingError(message);
  }
  if (message.includes('order_file.upload_expired')) {
    // qa-review round 1 (B2, BLOQUANT GRAVE, E10.22b/c) : meme code REUTILISE
    // qu `api_confirm_order_file_upload`, leve par cette fonction depuis
    // `20260910000700`.
    return new OrderFileUploadExpiredError(message);
  }
  if (message.includes('order_file.rejected')) {
    return new OrderFileRejectedError(message);
  }
  if (message.includes('order.not_found')) {
    return new OrderNotFoundError(message);
  }
  return new Error(message || 'Depot par lien impossible.');
}
