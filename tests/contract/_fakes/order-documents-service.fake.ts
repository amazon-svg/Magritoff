/**
 * Faux `OrderDocumentsService` pour les tests de contrat qui construisent
 * `CommercialOrdersService` sans porter sur E10.19b. Meme principe que
 * `createNullQuoteDocumentsService` (quote-documents) : chaque methode leve
 * si jamais appelee, sauf documentation contraire — les tests dedies au bon
 * de commande PDF (`commercial-order-documents.contract.test.ts`) fournissent
 * leur PROPRE faux, plus riche.
 */
import type { OrderDocumentsService } from '../../../src/modules/order-documents/application/order-documents-service.ts';

export function createNullOrderDocumentsService(): OrderDocumentsService {
  return {
    getForOrder: async () => {
      throw new Error('createNullOrderDocumentsService: getForOrder non implemente dans ce faux.');
    },
    generate: async () => {
      throw new Error('createNullOrderDocumentsService: generate non implemente dans ce faux.');
    },
  } as unknown as OrderDocumentsService;
}
