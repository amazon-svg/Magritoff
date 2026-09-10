import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  ConfirmOrderFileUploadCommand,
  OrderFileDetailDto,
  OrderFileDto,
  OrderFileUploadTicketDto,
  UpdateOrderFileCommand,
} from '../api/contracts.ts';

/** Aucun fichier vivant de cet identifiant sur cette commande dans le tenant du jeton (404 `order_file.not_found`). */
export class OrderFileNotFoundError extends Error {
  constructor(message = 'Fichier de commande introuvable sur cette commande.') {
    super(message);
    this.name = 'OrderFileNotFoundError';
  }
}

/** Aucune commande de cet identifiant dans le tenant du jeton (404 `order.not_found`, code REUTILISE, jamais redouble). */
export class OrderNotFoundError extends Error {
  constructor(message = 'Commande introuvable dans ce tenant.') {
    super(message);
    this.name = 'OrderNotFoundError';
  }
}

/** `confirmOrderFileUpload` appele sans qu un depot ait reussi au chemin attendu (404 `order_file.upload_missing`). */
export class OrderFileUploadMissingError extends Error {
  constructor(message = 'Aucun fichier depose au chemin attendu ; redemander un billet de depot.') {
    super(message);
    this.name = 'OrderFileUploadMissingError';
  }
}

/**
 * L objet depose existe mais est DEJA plus vieux que le delai de securite du
 * nettoyage des objets orphelins (24h, E10.22c) au moment de la confirmation
 * (409 `order_file.upload_expired`). qa-review round 1 (B2, BLOQUANT GRAVE,
 * E10.22b/c) : sans ce refus, une confirmation tardive peut creer une ligne
 * vivante sur un chemin DEJA liste comme candidat par le balayage orphelins
 * — destruction d un fichier legitime, sans aucune trace. Redemander un
 * billet de depot NEUF est le seul recours.
 */
export class OrderFileUploadExpiredError extends Error {
  constructor(message = 'Ce depot est expire ; redemander un billet de depot.') {
    super(message);
    this.name = 'OrderFileUploadExpiredError';
  }
}

/** Ce `file_id` porte deja une ligne : deposer deux fois les memes octets ne cree pas deux fichiers (409 `order_file.already_confirmed`). */
export class OrderFileAlreadyConfirmedError extends Error {
  constructor(message = 'Ce fichier a deja ete confirme.') {
    super(message);
    this.name = 'OrderFileAlreadyConfirmedError';
  }
}

/** La commande porte deja le nombre maximal de fichiers vivants (409/422 `order_file.limit_reached`). */
export class OrderFileLimitReachedError extends Error {
  constructor(message = 'Plafond de 30 fichiers vivants atteint pour cette commande.') {
    super(message);
    this.name = 'OrderFileLimitReachedError';
  }
}

/** `order_line_id` ne designe aucune ligne DE CETTE COMMANDE (422 `order_file.line_not_found`). */
export class OrderFileLineNotFoundError extends Error {
  constructor(message = 'La ligne citee n appartient pas a cette commande.') {
    super(message);
    this.name = 'OrderFileLineNotFoundError';
  }
}

/**
 * L objet depose depasse le plafond de poids ou porte un type hors de la
 * liste acceptee (422 `order_file.rejected`). Defense en profondeur : le
 * bucket refuse deja ces cas au `PUT`, cette erreur ne devrait normalement
 * jamais etre levee sur le chemin nominal.
 */
export class OrderFileRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderFileRejectedError';
  }
}

export type ListOrderFilesResult = readonly OrderFileDto[];

/**
 * Port (interface) du referentiel des fichiers de commande (E10.17a).
 * L implementation Supabase vit dans
 * src/adapters/supabase/order-files-repository.ts ; ce module n en connait
 * que le contrat.
 */
export interface OrderFilesRepository {
  /** `null` si la commande n existe pas dans le tenant (404 `order.not_found` cote route). */
  listByOrder(tenantId: TenantId, orderId: string): Promise<ListOrderFilesResult | null>;

  /** `null` si le fichier n existe pas (vivant) sur cette commande dans ce tenant (404 `order_file.not_found`). */
  findById(tenantId: TenantId, orderId: string, fileId: string): Promise<OrderFileDetailDto | null>;

  /**
   * Meme resolution que `findById`, SANS signer d URL de telechargement
   * (qa-review N6) : reservee au calcul de la precondition `If-Match` d
   * `updateOrderFile`, qui n a besoin d aucun champ signe (l `ETag` les
   * exclut deja). Evite un aller-retour Storage inutile a chaque bascule de
   * visibilite, et evite qu une panne Storage transitoire produise un 500
   * brut la ou seul un 404 `order_file.not_found` a un sens. `null` si le
   * fichier n existe pas (vivant) sur cette commande dans ce tenant.
   */
  findRawById(tenantId: TenantId, orderId: string, fileId: string): Promise<OrderFileDto | null>;

  /**
   * `issueOrderFileUploadUrl`. ALLOUE un `file_id` et le chemin qui en
   * decoule, sans creer de ligne (decision #8 du contrat). Verifie le
   * plafond PAR COURTOISIE (la barriere qui compte est celle de
   * `confirmUpload`, prise sous verrou). Leve `OrderNotFoundError`/
   * `OrderFileLimitReachedError`.
   */
  issueUploadUrl(tenantId: TenantId, orderId: string): Promise<OrderFileUploadTicketDto>;

  /**
   * `confirmOrderFileUpload` — LE SEUL endroit ou un fichier existe. Relit la
   * METADONNEE de l objet depose (`info(path)`, sans transferer les octets,
   * decision #7), verifie type/poids en defense en profondeur, puis appelle
   * `api_confirm_order_file_upload` (chemin recalcule EN BASE, jamais recu en
   * parametre). Leve `OrderNotFoundError`/`OrderFileUploadMissingError`/
   * `OrderFileUploadExpiredError`/`OrderFileRejectedError`/
   * `OrderFileLimitReachedError`/`OrderFileLineNotFoundError`/
   * `OrderFileAlreadyConfirmedError`.
   */
  confirmUpload(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: ConfirmOrderFileUploadCommand,
  ): Promise<OrderFileDto>;

  /**
   * `updateOrderFile` — seul champ modifiable : `visibility`. Leve
   * `OrderFileNotFoundError`.
   */
  updateVisibility(
    tenantId: TenantId,
    orderId: string,
    fileId: string,
    command: UpdateOrderFileCommand,
  ): Promise<OrderFileDto>;

  /**
   * `deleteOrderFile` — OCTETS DETRUITS, LIGNE CONSERVEE. Ordre PRESCRIT :
   * la ligne d abord (transactionnel, `api_delete_order_file`), l objet de
   * stockage ENSUITE (best-effort, echec journalise mais jamais rendu a
   * l appelant HTTP — le 204 est du point de vue de tout ce que Magrit lit).
   * Leve `OrderFileNotFoundError`.
   */
  remove(tenantId: TenantId, orderId: string, fileId: string, actor: UserId): Promise<void>;
}
