import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  ChangeOrderProductionStepCommand,
  CommercialOrderDetailDto,
  CommercialOrderDto,
  CommercialOrderSort,
  CommercialOrderStatus,
  OrderStepChangeDto,
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
 * E10.14 — la commande porte deja l etape visee (409 `order.step_unchanged`).
 * REFUS, pas un succes silencieux (contrat, decision #7,
 * docs/api/CONVENTIONS.md §8.16) : accepter le no-op ecrirait au journal
 * append-only une entree « X -> X » que rien ne pourrait retirer. Distinct
 * du rejeu d idempotence (meme cle + meme requete -> 201, jamais ce 409).
 */
export class OrderStepUnchangedError extends Error {
  constructor(message = 'La commande porte deja cette etape de production.') {
    super(message);
    this.name = 'OrderStepUnchangedError';
  }
}

/**
 * E10.14 — l etape visee existe mais est DESACTIVEE (422
 * `production_step.inactive`, code NEUF, decision #8). Distinct de
 * `ProductionStepNotFoundError` (E10.13, reutilise tel quel pour « cette
 * etape n existe pas chez vous ») : deux causes, deux reponses d ecran.
 */
export class ProductionStepInactiveError extends Error {
  constructor(message = 'Cette etape de production est desactivee, elle ne peut plus recevoir de commande.') {
    super(message);
    this.name = 'ProductionStepInactiveError';
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
 * E10.14 — pagination de `listOrderStepChanges`, ANTICHRONOLOGIQUE toujours
 * (`occurred_at desc, id desc`, contrat : aucun parametre de tri). `cursor`
 * porte directement `occurred_at`/`id` de la derniere ligne de la page
 * precedente — pas de token de tri compose, contrairement a
 * `ListCommercialOrdersParams.cursor` (un seul ordre possible ici).
 */
export type ListOrderStepChangesParams = Readonly<{
  size: number;
  cursor: Readonly<{ sort: string; id: string }> | null;
}>;

export type ListOrderStepChangesResult = Readonly<{
  /** `size + 1` lignes au plus, non tronquees ici — meme convention que `ListCommercialOrdersResult`. */
  rows: readonly OrderStepChangeDto[];
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

  /** E10.14 — journal antichronologique des changements d etape d une commande. 404 cote route si la commande est absente/hors tenant (verifie en amont par le SERVICE, `getSummary()`). */
  listStepChanges(
    tenantId: TenantId,
    orderId: string,
    params: ListOrderStepChangesParams,
  ): Promise<ListOrderStepChangesResult>;

  /**
   * `security definer` (`api_change_commercial_order_production_step`) :
   * verrouille la commande (`FOR UPDATE`), valide l etape cible, met a jour
   * `current_production_step_id` ET insere l entree de journal, DANS LA MEME
   * TRANSACTION (contrat, decision #4). AUCUN `If-Match` (decision #6) :
   * dernier ecrivain gagnant, assume.
   *
   * `actor` : `UserId` pour un jeton utilisateur, `null` pour une cle de
   * service. MEME PATRON que `convertQuote` ci-dessus : l implementation
   * Supabase l IGNORE (`void actor`), l auteur reel est porte par
   * `auth.uid()` cote base (session du jeton) — ce parametre n existe que
   * pour que l implementation en memoire (tests de contrat) puisse
   * reproduire fidelement `actor_id` sans session Postgres reelle.
   *
   * `serviceActorLabel` porte le libelle a inscrire au journal QUAND l acteur
   * n a pas de jeton utilisateur (cle de service, ex. `module:studio`) —
   * `null` pour un jeton utilisateur, la fonction resout alors l e-mail
   * elle-meme depuis `auth.uid()` (contrat §3 point 1, JAMAIS depuis le
   * corps : `ChangeOrderProductionStepCommand` ne porte aucun champ d auteur).
   *
   * Leve `CommercialOrderNotFoundError` (404), `ProductionStepNotFoundError`
   * (E10.13, reutilise, 422), `ProductionStepInactiveError` (422, code neuf),
   * `OrderStepUnchangedError` (409).
   */
  changeProductionStep(
    tenantId: TenantId,
    orderId: string,
    actor: UserId | null,
    command: ChangeOrderProductionStepCommand,
    serviceActorLabel: string | null,
  ): Promise<OrderStepChangeDto>;
}
