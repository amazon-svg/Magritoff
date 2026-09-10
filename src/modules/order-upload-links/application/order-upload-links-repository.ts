import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  CreateOrderUploadLinkCommand,
  OrderUploadLinkContextDto,
  OrderUploadLinkCreatedDto,
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

export type ListOrderUploadLinksResult = readonly OrderUploadLinkDto[];

/**
 * Port (interface) du referentiel des liens publics de depot (E10.20a).
 * L implementation Supabase vit dans
 * src/adapters/supabase/order-upload-links-repository.ts ; ce module n en
 * connait que le contrat.
 *
 * PERIMETRE DE CE LOT : les TROIS operations d atelier (`create`/
 * `listByOrder`/`revoke`, jeton UTILISATEUR) plus `getContext`
 * (`getOrderUploadLinkContext`, credential `orderUploadLink`). L emission du
 * billet et la confirmation de depot restent E10.20b — "AUCUN DEPOT
 * POSSIBLE" dans ce lot (docs/api/CONVENTIONS.md §8.21 §5).
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
}
