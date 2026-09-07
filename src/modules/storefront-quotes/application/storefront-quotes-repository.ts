/**
 * Port du module Devis du portail client (stories E10.10b-1, E10.10b-2).
 *
 * L implementation Supabase (`src/adapters/supabase/storefront-quotes-
 * repository.ts`) est un pur relai vers trois fonctions `security definer`
 * (`api_list_storefront_quotes`, `api_get_storefront_quote`,
 * `api_decide_storefront_quote`, migrations 20260906170000/20260907000000) :
 * l autorisation, le filtrage `show_discounts`, l arithmetique des totaux et
 * la garde de decision (session deleguee, statut, peremption, transition
 * atomique) vivent ENTIEREMENT en base, jamais ici.
 */
import type {
  StorefrontQuoteDecision,
  StorefrontQuoteDetailDto,
  StorefrontQuoteDto,
  StorefrontQuoteStatus,
} from '../api/contracts.ts';

/** Position de curseur, meme forme que `CursorPosition` (src/modules/_shared/application/pagination.ts). */
export type StorefrontQuotesCursor = Readonly<{ sort: string; id: string }>;

export type ListStorefrontQuotesCriteria = Readonly<{
  status: StorefrontQuoteStatus | null;
  /** Nombre de lignes a LIRE (deja `page.size + 1`, cf. `buildPage`). */
  limit: number;
  cursor: StorefrontQuotesCursor | null;
}>;

// ---------------------------------------------------------------------------
// E10.10b-2 — erreurs de domaine de la decision. Le REFUS de visibilite (4
// causes indiscernables) reste un `null`, comme `findById` : ce n est PAS une
// exception, exactement la meme discipline qu `api_get_storefront_quote`.
// ---------------------------------------------------------------------------

/**
 * Session `session_kind = 'delegated'` — un membre qui depanne un client LIT
 * comme lui, il n ENGAGE jamais a sa place (contrat §8.13quinquies, confirme
 * §8.13 point 7). 403 `quote.decision_forbidden_delegated`.
 */
export class StorefrontQuoteDecisionForbiddenDelegatedError extends Error {
  constructor(message = "Une session deleguee ne peut ni accepter ni refuser un devis.") {
    super(message);
    this.name = 'StorefrontQuoteDecisionForbiddenDelegatedError';
  }
}

/**
 * Le devis n est plus `sent` (deja decide dans un autre onglet, ou converti
 * par l atelier). 409 `quote.decision_forbidden_status`, nomme d apres l
 * OPERATION plutot que l etat rencontre (contrat, decision #4).
 */
export class StorefrontQuoteDecisionForbiddenStatusError extends Error {
  constructor(message = "Seul un devis 'sent' peut etre accepte ou refuse.") {
    super(message);
    this.name = 'StorefrontQuoteDecisionForbiddenStatusError';
  }
}

/**
 * `valid_until` depassee a l horloge du SERVEUR (meme expression que
 * `StorefrontQuote.expired`). 409 `quote.decision_expired`.
 */
export class StorefrontQuoteDecisionExpiredError extends Error {
  constructor(message = 'Ce devis est perime : il ne peut plus etre accepte ni refuse.') {
    super(message);
    this.name = 'StorefrontQuoteDecisionExpiredError';
  }
}

/**
 * E10.10b-2 — resultat d une decision reussie. `customerId` NE FAIT PARTIE
 * d AUCUNE representation servie au client (liste blanche `StorefrontQuote*`,
 * contrat b-1, decision #2) : il n existe qu au niveau APPLICATIF, pour que
 * le service puisse publier l evenement sortant
 * (`QuoteDecisionPayload.customer_id`) sans une seconde lecture. La route ne
 * doit jamais transmettre `customerId` au client.
 */
export type StorefrontQuoteDecisionResult = Readonly<{
  detail: StorefrontQuoteDetailDto;
  customerId: string;
}>;

export interface StorefrontQuotesRepository {
  /**
   * `sessionToken` est le jeton OPAQUE de la session boutique, jamais un
   * `accountId` deja resolu : la fonction SQL re-verifie elle-meme la session
   * (voir l en-tete de la migration pour le raisonnement de securite —
   * ces fonctions sont GRANT EXECUTE a `anon`, donc joignables directement).
   */
  list(
    sessionToken: string,
    criteria: ListStorefrontQuotesCriteria,
  ): Promise<readonly StorefrontQuoteDto[]>;

  /** `null` sur les quatre causes indiscernables (contrat, 404 `quote.not_found`). */
  findById(sessionToken: string, quoteId: string): Promise<StorefrontQuoteDetailDto | null>;

  /**
   * E10.10b-2 — ACCEPTE ou REFUSE un devis `sent`. `null` sur les memes
   * quatre causes indiscernables que `findById` (404 `quote.not_found`,
   * jamais une exception) ; leve l une des trois erreurs de domaine
   * ci-dessus sinon.
   */
  decide(
    sessionToken: string,
    quoteId: string,
    decision: StorefrontQuoteDecision,
  ): Promise<StorefrontQuoteDecisionResult | null>;
}
