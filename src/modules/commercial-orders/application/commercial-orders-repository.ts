import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  CommercialOrderDetailDto,
  CommercialOrderDto,
  CommercialOrderSort,
  CommercialOrderStatus,
} from '../api/contracts.ts';

/**
 * La commande n existe pas dans le tenant du jeton (404 `order.not_found`).
 * Nom distinct de `QuoteNotFoundError` (module `commercial-quotes`) : deux
 * ressources differentes, deux 404 differents — le domaine de code d erreur
 * reste `order.*` (contrat, decision #2 de docs/api/CONVENTIONS.md §8.14),
 * meme quand la ressource vit sous `/commercial-orders`.
 */
export class CommercialOrderNotFoundError extends Error {
  constructor(message = 'Commande introuvable dans ce tenant.') {
    super(message);
    this.name = 'CommercialOrderNotFoundError';
  }
}

/**
 * `convertQuote` sur un devis dont le statut n autorise pas la conversion
 * (409 `quote.conversion_forbidden_status`). Couvre les quatre statuts
 * refuses (`draft`, `rejected`, `converted` — et, par construction, tout
 * statut qui ne serait ni `sent` ni `accepted`) ; la nuance se lit dans
 * `current_state.status`, jamais dans un second code.
 */
export class QuoteConversionForbiddenStatusError extends Error {
  constructor(
    message = "Seul un devis 'sent' ou 'accepted' peut etre transforme en commande.",
  ) {
    super(message);
    this.name = 'QuoteConversionForbiddenStatusError';
  }
}

/**
 * E10.13 CA6 — `sort` porte le TOKEN COMPLET du contrat (`CommercialOrderSort`),
 * pas seulement un champ : `production_step` et `-production_step` exigent un
 * comportement de tri distinct (lecture par
 * `list_commercial_orders_by_production_step`, migration `20260908020000`),
 * pas seulement une direction inversee sur la meme colonne.
 *
 * `cursor.sort` reste une chaine OPAQUE cote route (meme discipline que le
 * reste du contrat) : pour `-created_at`/`created_at` c est directement
 * l ISO `created_at` de la derniere ligne (INCHANGE, retro-compatible) ; pour
 * `production_step`/`-production_step` c est la paire
 * `${current_production_step_id ?? ''}|${created_at}`, decodee par
 * l ADAPTATEUR (jamais par ce port) puisque seul lui sait quelle lecture
 * appeler.
 */
export type ListCommercialOrdersParams = Readonly<{
  customerId: string | null;
  quoteId: string | null;
  status: CommercialOrderStatus | null;
  /** E10.13 CA6 — egalite stricte sur l etape de production COURANTE. */
  currentProductionStepId: string | null;
  sort: CommercialOrderSort;
  size: number;
  cursor: Readonly<{ sort: string; id: string }> | null;
}>;

export type ListCommercialOrdersResult = Readonly<{
  /** `size + 1` lignes au plus, non tronquees ici — meme convention que `ListQuotesResult`. */
  rows: readonly CommercialOrderDto[];
}>;

/**
 * Port (interface) du referentiel Commandes de gestion commerciale.
 * L implementation Supabase vit dans
 * src/adapters/supabase/commercial-orders-repository.ts ; ce module n en
 * connait que le contrat.
 */
export interface CommercialOrdersRepository {
  list(tenantId: TenantId, params: ListCommercialOrdersParams): Promise<ListCommercialOrdersResult>;

  /** `null` si absente ou hors du tenant (404 cote route, jamais 403). */
  findById(tenantId: TenantId, orderId: string): Promise<CommercialOrderDto | null>;

  findDetailById(tenantId: TenantId, orderId: string): Promise<CommercialOrderDetailDto | null>;

  /**
   * VALIDE le devis `quoteId` et le transforme en commande — delegue
   * ENTIEREMENT a `api_convert_commercial_quote` (`security definer`,
   * migration 20260908010000) : transition atomique du devis
   * (`sent`/`accepted` -> `converted`), numerotation, copie figee des lignes
   * et des totaux, audit d entete, TOUT dans la MEME transaction Postgres.
   *
   * Leve `QuoteConversionForbiddenStatusError` si le devis n est ni `sent`
   * ni `accepted` au moment de la transition. L existence du devis est deja
   * verifiee par le SERVICE avant cet appel (`CommercialQuotesService.
   * getSummary()`, 404 `QuoteNotFoundError`) ; l implementation peut NEANMOINS
   * relever `QuoteNotFoundError` en defense en profondeur (course entre la
   * verification du service et cet appel — la fonction Postgres reverifie
   * elle-meme l existence dans le tenant).
   */
  convertQuote(tenantId: TenantId, actor: UserId, quoteId: string): Promise<CommercialOrderDetailDto>;
}
