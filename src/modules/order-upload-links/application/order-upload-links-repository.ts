import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { OrderFileUploadTicketDto } from '../../order-files/api/contracts.ts';
import type {
  ConfirmOrderUploadLinkFileCommand,
  CreateOrderUploadLinkCommand,
  OrderUploadLinkContextDto,
  OrderUploadLinkCreatedDto,
  OrderUploadLinkDepositDto,
  OrderUploadLinkDto,
} from '../api/contracts.ts';

/** Aucune commande de cet identifiant dans le tenant du jeton (404 `order.not_found`, code REUTILISE — meme discipline qu order-files). */
export class OrderNotFoundError extends Error {
  constructor(message = 'Commande introuvable dans ce tenant.') {
    super(message);
    this.name = 'OrderNotFoundError';
  }
}

/** Aucun lien VIVANT de cet identifiant sur cette commande dans le tenant du jeton (404 `upload_link.not_found`). */
export class OrderUploadLinkNotFoundError extends Error {
  constructor(message = 'Lien de depot introuvable sur cette commande.') {
    super(message);
    this.name = 'OrderUploadLinkNotFoundError';
  }
}

/** La commande porte deja le nombre maximal de liens VIVANTS (409 `upload_link.limit_reached`, plafond 10). */
export class OrderUploadLinkLimitReachedError extends Error {
  constructor(message = 'Plafond de 10 liens de depot vivants atteint pour cette commande.') {
    super(message);
    this.name = 'OrderUploadLinkLimitReachedError';
  }
}

/**
 * E10.20b — le lien a atteint son propre `max_files`, OU la commande ses 30
 * fichiers vivants (409 `upload_link.file_limit_reached`). UN SEUL CODE pour
 * les deux causes (contrat) : le porteur du lien ne peut agir sur ni l une
 * ni l autre.
 */
export class OrderUploadLinkFileLimitReachedError extends Error {
  constructor(message = 'Plafond de fichiers atteint pour ce lien ou cette commande.') {
    super(message);
    this.name = 'OrderUploadLinkFileLimitReachedError';
  }
}

export type ListOrderUploadLinksResult = readonly OrderUploadLinkDto[];

/**
 * E10.20b — resultat de `confirmFileUpload`, PORTE en plus du recu client
 * (`deposit`) ce dont le SERVICE a besoin pour publier `order.files_
 * submitted` (`OrderFilesSubmittedPayload` : `file_id`, `upload_link_id`,
 * `order_id`, `order_number`, `customer_id`) — sans obliger une seconde
 * lecture de la commande apres l ecriture.
 */
export type ConfirmOrderUploadLinkFileResult = Readonly<{
  deposit: OrderUploadLinkDepositDto;
  tenantId: TenantId;
  uploadLinkId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
}>;

/**
 * Port (interface) du referentiel des liens publics de depot
 * (stories E10.20a/E10.20b). L implementation Supabase vit dans
 * src/adapters/supabase/order-upload-links-repository.ts ; ce module n en
 * connait que le contrat.
 *
 * PERIMETRE : les TROIS operations d atelier (`create`/`listByOrder`/
 * `revoke`, jeton UTILISATEUR), `getContext` (`getOrderUploadLinkContext`,
 * credential `orderUploadLink`), PLUS les deux operations de depot d E10.20b
 * (`issueFileUploadUrl`/`confirmFileUpload`).
 */
export interface OrderUploadLinksRepository {
  /**
   * `createOrderUploadLink`. Genere le jeton, n en persiste que l empreinte
   * `sha256`, et rend le SEUL DTO de tout ce module qui porte le jeton en
   * clair. Leve `OrderNotFoundError`/`OrderUploadLinkLimitReachedError`.
   */
  create(
    tenantId: TenantId,
    orderId: string,
    actor: UserId,
    command: CreateOrderUploadLinkCommand,
  ): Promise<OrderUploadLinkCreatedDto>;

  /**
   * `listOrderUploadLinks`. `null` si la commande n existe pas dans le
   * tenant (404 `order.not_found` cote route). Rend les liens VIVANTS
   * uniquement (ni expires, ni revoques), JAMAIS le jeton.
   */
  listByOrder(tenantId: TenantId, orderId: string): Promise<ListOrderUploadLinksResult | null>;

  /**
   * `revokeOrderUploadLink`. Pose `revoked_at`/`revoked_by`/
   * `revoked_by_label` ; la ligne survit comme trace d audit. Leve
   * `OrderUploadLinkNotFoundError` si aucun lien VIVANT de cet identifiant
   * n existe sur cette commande dans ce tenant (rejouer une revocation
   * deja faite rend la MEME erreur, un lien revoque etant indiscernable
   * d un lien inconnu — contrat).
   */
  revoke(tenantId: TenantId, orderId: string, linkId: string, actor: UserId): Promise<void>;

  /**
   * `getOrderUploadLinkContext` — cote CLIENT, credential `orderUploadLink`.
   * RE-VERIFIE le jeton lui-meme (jamais de `linkId` transmis en clair comme
   * un identifiant deja authentifie — meme discipline que les fonctions
   * storefront qui re-verifient `sessionToken`), incremente `use_count`/
   * `first_used_at`/`last_used_at` (trace d usage, contrat). `null` si le
   * lien n est plus valide au moment de cet appel (401 `upload_link.invalid`
   * cote route) — TOCTOU possible entre la resolution du principal et cet
   * appel (un lien revoque entre les deux), traite ici plutot qu ignore.
   */
  getContext(token: string): Promise<OrderUploadLinkContextDto | null>;

  /**
   * E10.20b — `issueOrderUploadLinkFileUrl`. PATRON EXACT d
   * `OrderFilesRepository.issueUploadUrl` : ALLOUE un `file_id` et le
   * chemin qui en decoule, aucune ligne creee. RE-VERIFIE le jeton (jamais
   * un `orderId`/`tenantId` de principal deja resolu transmis en clair
   * comme authentifie), verifie les DEUX plafonds PAR COURTOISIE (le lien
   * et la commande — la barriere qui compte est celle de `confirmFileUpload`,
   * prise sous verrou). Leve `OrderUploadLinkNotFoundError` (401
   * `upload_link.invalid` cote route, jeton invalide/expire/revoque entre la
   * resolution du principal et cet appel) / `OrderUploadLinkFileLimitReachedError`.
   */
  issueFileUploadUrl(token: string): Promise<OrderFileUploadTicketDto>;

  /**
   * E10.20b — `confirmOrderUploadLinkFile`. RE-VERIFIE le jeton, relit la
   * METADONNEE de l objet depose (`info(path)`, sans transferer les octets),
   * verifie type/poids en defense en profondeur, puis appelle
   * `api_confirm_order_file_upload_by_link` (chemin recalcule EN BASE
   * depuis le TENANT DE LA COMMANDE resolue par le lien, jamais recu en
   * parametre). Leve `OrderUploadLinkNotFoundError` (401 `upload_link.invalid`,
   * y compris TOCTOU entre le billet et la confirmation) /
   * `OrderFileUploadMissingError` (order-files, code REUTILISE) /
   * `OrderFileRejectedError` (order-files, code REUTILISE) /
   * `OrderFileAlreadyConfirmedError` (order-files, code REUTILISE) /
   * `OrderUploadLinkFileLimitReachedError`.
   */
  confirmFileUpload(
    token: string,
    command: ConfirmOrderUploadLinkFileCommand,
  ): Promise<ConfirmOrderUploadLinkFileResult>;
}
