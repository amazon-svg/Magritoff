/**
 * Service applicatif du module Devis du portail client (story E10.10b-1).
 *
 * Delibrement mince : aucun calcul, aucune regle metier — l autorisation
 * (chaine `commercial_quotes.customer_id -> customers -> customer_contacts ->
 * shop_customer_accounts`, E10.5), le statut visible et l arithmetique des
 * totaux vivent tous dans les fonctions `security definer` de la migration
 * 20260906170000. Ce service existe pour suivre la convention de dossiers du
 * depot (`api/` + `application/` + adaptateur + routes), pas pour porter de
 * la logique.
 */
import type { StorefrontQuoteDetailDto, StorefrontQuoteDto } from '../api/contracts.ts';
import type {
  ListStorefrontQuotesCriteria,
  StorefrontQuotesRepository,
} from './storefront-quotes-repository.ts';

export class StorefrontQuotesService {
  constructor(private readonly repository: StorefrontQuotesRepository) {}

  async list(
    sessionToken: string,
    criteria: ListStorefrontQuotesCriteria,
  ): Promise<readonly StorefrontQuoteDto[]> {
    return this.repository.list(sessionToken, criteria);
  }

  async getDetail(sessionToken: string, quoteId: string): Promise<StorefrontQuoteDetailDto | null> {
    return this.repository.findById(sessionToken, quoteId);
  }
}
