import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { PricedLineBreakdownItem } from '../../pricing/application/pricing-engine.ts';
import type {
  CreateQuoteFromProjectCommand,
  QuoteAuditEntryDto,
  QuoteDetailDto,
  QuoteDto,
  QuoteLineDto,
  QuoteStatus,
  SendQuoteCommand,
  TaxRegimeDto,
  UpdateQuoteCommand,
} from '../api/contracts.ts';

export type ListQuotesParams = Readonly<{
  customerId: string | null;
  projectId: string | null;
  status: QuoteStatus | null;
  size: number;
  cursor: Readonly<{ sort: string; id: string }> | null;
}>;

export type ListQuotesResult = Readonly<{
  /**
   * `size + 1` lignes lues au plus (non tronquees ici) : la ligne
   * excedentaire, si presente, prouve l existence d une page suivante.
   * `buildPage()` fait le decoupage et encode le curseur suivant.
   */
  rows: readonly QuoteDto[];
}>;

/** Rejete quand une commande viole une regle metier non portee par le schema Zod. */
export class QuoteCommandRejectedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors: readonly Readonly<{ field: string; message: string }>[] = [],
  ) {
    super(message);
    this.name = 'QuoteCommandRejectedError';
  }
}

/** Le devis n existe pas dans le tenant du jeton. */
export class QuoteNotFoundError extends Error {
  constructor(message = 'Devis introuvable dans ce tenant.') {
    super(message);
    this.name = 'QuoteNotFoundError';
  }
}

/** Le projet source n existe pas dans le tenant du jeton (creation refusee). */
export class QuoteProjectNotFoundError extends Error {
  constructor(message = 'Projet introuvable dans ce tenant.') {
    super(message);
    this.name = 'QuoteProjectNotFoundError';
  }
}

/**
 * CA6 : un devis ne se supprime qu a l etat brouillon. Distinct de
 * `QuoteCommandRejectedError` (422, forme/regle metier de creation) : c est
 * un conflit d etat (409), le devis existe et est parfaitement valide.
 */
export class QuoteDeleteRequiresDraftError extends Error {
  constructor(message = 'Seul un devis a l etat brouillon peut etre supprime.') {
    super(message);
    this.name = 'QuoteDeleteRequiresDraftError';
  }
}

// ---------------------------------------------------------------------------
// E10.10a — erreurs de domaine de l envoi, du renvoi, de la duplication et de
// la garde de statut sur updateQuote.
// ---------------------------------------------------------------------------

/**
 * `updateQuote` sur un devis qui n est plus `draft` (`quote.update_requires_draft`).
 * Solde la dette p4 de docs/api/CONVENTIONS.md §8.6 : premiere story a
 * produire un statut != draft, donc premiere a rendre cette garde opposable.
 */
export class QuoteUpdateRequiresDraftError extends Error {
  constructor(message = "Seul un devis a l etat brouillon peut etre modifie : le dupliquer pour le reprendre.") {
    super(message);
    this.name = 'QuoteUpdateRequiresDraftError';
  }
}

/**
 * `sendQuote` sur un devis dont le statut n autorise ni un premier envoi
 * (`draft`) ni un renvoi (`sent`) — `quote.send_forbidden_status` (409).
 */
export class QuoteSendForbiddenStatusError extends Error {
  constructor(message = "Seuls les devis 'draft' (premier envoi) et 'sent' (renvoi) peuvent etre envoyes.") {
    super(message);
    this.name = 'QuoteSendForbiddenStatusError';
  }
}

/** Premier envoi d un devis sans aucune ligne — `quote.send_requires_lines` (422). */
export class QuoteSendRequiresLinesError extends Error {
  constructor(message = "Un devis sans ligne n est pas une offre : ajouter au moins une ligne avant l envoi.") {
    super(message);
    this.name = 'QuoteSendRequiresLinesError';
  }
}

/**
 * Renvoi (`sent` -> `sent`) avec un `show_discounts` different de la valeur
 * deja enregistree — `quote.resend_immutable` (422). Le contenu d un devis
 * deja envoye ne se retouche pas ; il se duplique.
 */
export class QuoteResendImmutableError extends Error {
  constructor(
    message = "Un renvoi ne peut pas changer show_discounts : dupliquer le devis pour en changer le contenu.",
  ) {
    super(message);
    this.name = 'QuoteResendImmutableError';
  }
}

// ---------------------------------------------------------------------------
// E10.9 — erreurs de domaine des lignes de devis.
// ---------------------------------------------------------------------------

/** La ligne n existe pas dans ce devis, dans le tenant du jeton (`quote_line.not_found`). */
export class QuoteLineNotFoundError extends Error {
  constructor(message = 'Ligne de devis introuvable dans ce devis.') {
    super(message);
    this.name = 'QuoteLineNotFoundError';
  }
}

/** Toute ecriture sur une ligne exige un devis a l etat brouillon (`quote_line.quote_not_draft`). */
export class QuoteLineQuoteNotDraftError extends Error {
  constructor(message = 'Le devis n est plus a l etat brouillon.') {
    super(message);
    this.name = 'QuoteLineQuoteNotDraftError';
  }
}

/** `project_item_id` ne designe aucun element du projet source (`quote_line.project_item_invalid`). */
export class QuoteLineProjectItemInvalidError extends Error {
  constructor(message = "L element de projet ne correspond pas au projet source de ce devis.") {
    super(message);
    this.name = 'QuoteLineProjectItemInvalidError';
  }
}

/** `quantity` fournie est inferieure a 1 (`quote_line.invalid_quantity`). */
export class QuoteLineInvalidQuantityError extends Error {
  constructor(message = 'La quantite doit etre superieure ou egale a 1.') {
    super(message);
    this.name = 'QuoteLineInvalidQuantityError';
  }
}

/** `margin_rate` envoye sur une ligne dont `production_price` vaut "0.00" (`quote_line.margin_not_derivable`). */
export class QuoteLineMarginNotDerivableError extends Error {
  constructor(
    message = 'Le taux de marge ne peut pas etre derive sur un cout de production nul : passer par sale_price.',
  ) {
    super(message);
    this.name = 'QuoteLineMarginNotDerivableError';
  }
}

/** `line_ids` ne recouvre pas exactement les lignes existantes (`quote_line.positions_mismatch`). */
export class QuoteLinePositionsMismatchError extends Error {
  constructor(message = 'line_ids ne recouvre pas exactement les lignes existantes de ce devis.') {
    super(message);
    this.name = 'QuoteLinePositionsMismatchError';
  }
}

/**
 * `margin_rate` envoye produirait un `sale_price` negatif, non representable
 * (`quote_line.invalid_margin_rate`, qa-review C1). Distinct de
 * `QuoteLineMarginNotDerivableError` (division par zero) : ici c est le
 * RESULTAT du calcul qui sort du domaine representable, pas l operation qui
 * est indefinie.
 */
export class QuoteLineInvalidMarginRateError extends Error {
  constructor(
    message = 'Le taux de marge fourni produirait un prix de vente negatif : passer par sale_price.',
  ) {
    super(message);
    this.name = 'QuoteLineInvalidMarginRateError';
  }
}

/**
 * Ligne PRETE A PERSISTER : tous les champs de prix ont deja ete calcules par
 * le service (`PriceRulesService.resolve()` + `PricingEngine.price()` +
 * `quote-line-pricing.ts`). Le repository ne fait AUCUN calcul de prix, il
 * persiste ce qu on lui donne (CA, interdit absolu du sprint).
 */
export type PricedQuoteLineWrite = Readonly<{
  origin: 'project_item' | 'free';
  projectItemId: string | null;
  label: string;
  productConfig: Readonly<Record<string, unknown>>;
  quantity: number;
  chiffrageQuantity: number | null;
  productionPrice: string;
  publicPrice: string;
  customerPrice: string;
  appliedMarginRate: string;
  appliedRuleId: string | null;
  salePrice: string;
  saleMarginRate: string | null;
  discountRate: string | null;
  marginVariation: string | null;
  breakdown: readonly PricedLineBreakdownItem[];
}>;

/** Champs persistes modifies par un `updateQuoteLine` (deja calcules par le service). */
export type QuoteLineWriteUpdate = Readonly<{
  quantity?: number;
  salePrice?: string;
  saleMarginRate?: string | null;
  discountRate?: string | null;
  marginVariation?: string | null;
}>;

export type ListQuoteLineAuditParams = Readonly<{
  quoteId: string;
  lineId: string | null;
  size: number;
  cursor: Readonly<{ sort: string; id: string }> | null;
}>;

export type QuoteLineAuditRow = Readonly<{
  id: string;
  quote_id: string;
  quote_line_id: string;
  change_set_id: string;
  action: 'added' | 'updated' | 'removed' | 'reordered';
  field: 'sale_price' | 'discount_rate' | 'margin_variation' | 'quantity' | 'position' | null;
  previous_value: string | null;
  new_value: string | null;
  line_snapshot: Readonly<Record<string, unknown>> | null;
  actor_id: string | null;
  actor_label: string | null;
  occurred_at: string;
}>;

export type ListQuoteLineAuditResult = Readonly<{ rows: readonly QuoteLineAuditRow[] }>;

// ---------------------------------------------------------------------------
// E10.10a — journal d audit de l ENTETE (distinct du journal des lignes).
// ---------------------------------------------------------------------------

export type ListQuoteHeaderAuditParams = Readonly<{
  quoteId: string;
  size: number;
  cursor: Readonly<{ sort: string; id: string }> | null;
}>;

export type QuoteHeaderAuditRow = QuoteAuditEntryDto;

export type ListQuoteHeaderAuditResult = Readonly<{ rows: readonly QuoteHeaderAuditRow[] }>;

/**
 * Port (interface) du referentiel Devis commerciaux. L implementation
 * Supabase vit dans src/adapters/supabase/commercial-quotes-repository.ts ;
 * ce module n en connait que le contrat.
 */
export interface CommercialQuotesRepository {
  list(tenantId: TenantId, params: ListQuotesParams): Promise<ListQuotesResult>;

  /** `null` si absent ou hors du tenant (404 cote route, jamais 403). */
  findById(tenantId: TenantId, quoteId: string): Promise<QuoteDto | null>;

  findDetailById(tenantId: TenantId, quoteId: string): Promise<QuoteDetailDto | null>;

  /**
   * CA2, CA3, CA4, CA5 — creation TRANSACTIONNELLE : numerotation, creation
   * du devis et de ses lignes aboutissent ou echouent ENSEMBLE. Leve
   * `QuoteProjectNotFoundError` si `command.project_id` n existe pas dans le
   * tenant, `QuoteCommandRejectedError('quote.items_invalid', ...)` si
   * `item_ids` est vide ou designe un element hors du projet.
   */
  createFromProjectItems(
    tenantId: TenantId,
    actor: UserId,
    command: CreateQuoteFromProjectCommand,
  ): Promise<QuoteDetailDto>;

  /**
   * E10.10a — garde d etat (409 `quote.update_requires_draft`) : leve
   * `QuoteUpdateRequiresDraftError` des que le devis n est plus `draft`,
   * MEME condition d ecriture que `remove()` (le filtre par statut fait
   * partie de l operation elle-meme).
   */
  update(tenantId: TenantId, quoteId: string, command: UpdateQuoteCommand): Promise<QuoteDto>;

  /** Leve `QuoteDeleteRequiresDraftError` si le devis n est pas a l etat brouillon. */
  remove(tenantId: TenantId, quoteId: string): Promise<void>;

  // -------------------------------------------------------------------------
  // E10.10a — statut, envoi/renvoi, duplication, remise globale, TVA.
  // -------------------------------------------------------------------------

  /**
   * ENVOIE (premier envoi, devis `draft`) ou RENVOIE (devis `sent`) un devis.
   * Transition atomique : statut, horodatage, calcul de `valid_until` si
   * necessaire, ecriture d audit (`sent`/`resent`, + `updated` par champ
   * change) sont portes par UNE SEULE fonction Postgres
   * (`api_send_commercial_quote`, meme raisonnement que
   * `api_create_commercial_quote_from_project_items`, PostgREST n offrant pas
   * de transaction multi-requetes).
   *
   * Leve `QuoteSendForbiddenStatusError` (statut ni `draft` ni `sent`),
   * `QuoteSendRequiresLinesError` (premier envoi d un devis sans ligne) ou
   * `QuoteResendImmutableError` (renvoi avec `show_discounts` divergent).
   */
  sendQuote(
    tenantId: TenantId,
    actor: UserId,
    quoteId: string,
    command: SendQuoteCommand,
  ): Promise<QuoteDetailDto>;

  /**
   * DUPLIQUE un devis : nouveau devis `draft`, nouveau numero,
   * `source_quote_id` renseigne, lignes recopiees avec leur geste commercial
   * DEJA FIGE (aucun recalcul de prix — E10.8 gelee, et une copie doit
   * refleter l offre telle qu elle a ete faite). `valid_until` REMISE a
   * `null` (jamais recopiee). Entree d audit `duplicated` sur le devis
   * ORIGINAL. Autorise depuis N IMPORTE QUEL statut (aucune garde d etat :
   * dupliquer ne modifie jamais le devis source).
   */
  duplicateQuote(tenantId: TenantId, actor: UserId, quoteId: string): Promise<QuoteDetailDto>;

  /**
   * Journal d audit de l ENTETE d un devis (E10.10a), distinct du journal des
   * LIGNES (E10.9, `listLineAuditEntries`). Garde `can_manage_pricing`
   * verifiee par le SERVICE avant cet appel, meme discipline que
   * `listAuditEntries`.
   */
  listHeaderAuditEntries(
    tenantId: TenantId,
    params: ListQuoteHeaderAuditParams,
  ): Promise<ListQuoteHeaderAuditResult>;

  /**
   * Regime fiscal du tenant (`tenants.tax_regime`), toujours renseigne
   * (colonne NOT NULL, defaut `metropole_fr`). Sert a resoudre
   * `QuoteTotals.vat_rate`/`vat_regime` quand le devis ne porte pas de
   * surcharge (`Quote.vat_rate`).
   */
  getTenantTaxRegime(tenantId: TenantId): Promise<TaxRegimeDto>;

  // -------------------------------------------------------------------------
  // E10.9 — lignes de devis.
  // -------------------------------------------------------------------------

  /** `null` si absente, ou si elle n appartient pas a `quoteId` (404 `quote_line.not_found`). */
  findLineById(tenantId: TenantId, quoteId: string, lineId: string): Promise<QuoteLineDto | null>;

  /**
   * Insere une ligne DEJA ENTIEREMENT PRICEE (`PricedQuoteLineWrite`), en fin
   * de devis (`position` = derniere + 1). Leve `QuoteLineQuoteNotDraftError`
   * si le devis n est pas brouillon.
   */
  addLine(tenantId: TenantId, quoteId: string, line: PricedQuoteLineWrite): Promise<QuoteLineDto>;

  /**
   * Applique les champs DEJA CALCULES par le service. La concurrence
   * optimiste (CA9, `If-Match`) est verifiee par la ROUTE avant cet appel
   * (`assertPrecondition`, meme pattern que `updateQuote`/
   * `updateCustomerContact`) : ce port n a donc pas a la reverifier. Leve
   * `QuoteLineNotFoundError` ou `QuoteLineQuoteNotDraftError`.
   */
  updateLine(
    tenantId: TenantId,
    quoteId: string,
    lineId: string,
    update: QuoteLineWriteUpdate,
  ): Promise<QuoteLineDto>;

  /**
   * Retire la ligne et resserre les positions des lignes suivantes, dans une
   * seule transaction cote base (`api_delete_commercial_quote_line`). Leve
   * `QuoteLineNotFoundError` ou `QuoteLineQuoteNotDraftError`.
   */
  removeLine(tenantId: TenantId, quoteId: string, lineId: string): Promise<void>;

  /**
   * Reordonne integralement les lignes du devis
   * (`api_reorder_commercial_quote_lines`). Leve
   * `QuoteLinePositionsMismatchError` ou `QuoteLineQuoteNotDraftError`.
   */
  reorderLines(tenantId: TenantId, quoteId: string, lineIds: readonly string[]): Promise<QuoteDetailDto>;

  listLineAuditEntries(
    tenantId: TenantId,
    params: ListQuoteLineAuditParams,
  ): Promise<ListQuoteLineAuditResult>;

  /**
   * Evalue le droit metier `can_manage_pricing` (E10.11) de l acteur dans le
   * tenant, via `public.user_has_capability` (le meme mecanisme, deja
   * exploite par `SupabaseRolesRepository.userCapability()` — pas duplique,
   * juste appele depuis cet adaptateur pour eviter une dependance croisee
   * entre modules). Garde d acces de `listQuoteAuditEntries` (403
   * `identity.role_required` si `false`). Un `admin` du tenant
   * recoit `true` par derivation (regle portee par `user_has_capability`,
   * pas par ce port) : aucun acteur qui avait acces avant E10.11 ne le perd.
   */
  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean>;
}
