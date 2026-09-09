/**
 * Faux `QuoteDocumentsService` pour les tests de contrat qui exercent
 * `sendQuote` sans porter sur E10.10b-4c. Reproduit le cas NOMINAL (a) du
 * contrat §8.18 : aucun gabarit configure -> l envoi continue SANS piece
 * jointe, jamais une erreur. Les tests dedies a 4c (moteur de generation,
 * branchement) fournissent leur PROPRE faux, plus riche, pour exercer les
 * quatre combinaisons (gabarit eligible/absent x generation reussie/en echec).
 */
import type { QuoteDocumentsService } from '../../../src/modules/quote-documents/application/quote-documents-service.ts';

export function createNullQuoteDocumentsService(): QuoteDocumentsService {
  return {
    getForQuote: async () => {
      throw new Error('createNullQuoteDocumentsService: getForQuote non implemente dans ce faux.');
    },
    getForStorefrontSession: async () => null,
    renderForFirstSend: async () => null,
    persistRendered: async () => {
      throw new Error('createNullQuoteDocumentsService: persistRendered ne devrait jamais etre appele (renderForFirstSend rend toujours null).');
    },
  } as unknown as QuoteDocumentsService;
}
