import type { ClariprintQuoteCommand, ClariprintQuoteResult } from '../api/contracts.ts';

export interface ClariprintQuoteGateway {
  quote(command: ClariprintQuoteCommand): Promise<ClariprintQuoteResult>;
}
