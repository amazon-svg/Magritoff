/**
 * Port du module Devis du portail client (story E10.10b-1).
 *
 * L implementation Supabase (`src/adapters/supabase/storefront-quotes-
 * repository.ts`) est un pur relai vers deux fonctions `security definer`
 * (`api_list_storefront_quotes`, `api_get_storefront_quote`,
 * migration 20260906170000) : l autorisation, le filtrage `show_discounts` et
 * l arithmetique des totaux vivent ENTIEREMENT en base, jamais ici.
 */
import type { StorefrontQuoteDetailDto, StorefrontQuoteDto, StorefrontQuoteStatus } from '../api/contracts.ts';

/** Position de curseur, meme forme que `CursorPosition` (src/modules/_shared/application/pagination.ts). */
export type StorefrontQuotesCursor = Readonly<{ sort: string; id: string }>;

export type ListStorefrontQuotesCriteria = Readonly<{
  status: StorefrontQuoteStatus | null;
  /** Nombre de lignes a LIRE (deja `page.size + 1`, cf. `buildPage`). */
  limit: number;
  cursor: StorefrontQuotesCursor | null;
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
}
