import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  CreateQuoteFromProjectCommand,
  QuoteDetailDto,
  QuoteDto,
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
}
