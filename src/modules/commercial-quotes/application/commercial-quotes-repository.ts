import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type { PricedLineBreakdownItem } from '../../pricing/application/pricing-engine.ts';
import type {
  CreateQuoteFromProjectCommand,
  QuoteDetailDto,
  QuoteDto,
  QuoteLineDto,
  QuoteStatus,
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

  update(tenantId: TenantId, quoteId: string, command: UpdateQuoteCommand): Promise<QuoteDto>;

  /** Leve `QuoteDeleteRequiresDraftError` si le devis n est pas a l etat brouillon. */
  remove(tenantId: TenantId, quoteId: string): Promise<void>;

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
   * Role de l acteur dans le tenant (`admin`/`member`), `null` si non membre.
   * Garde d acces de `listQuoteAuditEntries` (403 `identity.role_required`
   * hors `admin`) en attendant le droit dedie `can_manage_pricing` (E10.11) —
   * meme mecanisme que l ecran des regles de prix (E10.6 CA7).
   */
  findActorTenantRole(tenantId: TenantId, actorId: UserId): Promise<'admin' | 'member' | null>;
}
