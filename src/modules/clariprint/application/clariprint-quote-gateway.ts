import type { ClariprintQuoteCommand, ClariprintQuoteResult } from '../api/contracts.ts';

export interface ClariprintQuoteGateway {
  /**
   * `requestId` : BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) — permet
   * à une implémentation de journaliser un verdict retrouvable par
   * `request_id`. Optionnel : une implémentation qui n'en a pas l'usage
   * l'ignore.
   */
  quote(command: ClariprintQuoteCommand, requestId?: string): Promise<ClariprintQuoteResult>;
}
