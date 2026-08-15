import type { ClariprintQuoteCommand, ClariprintQuoteResult } from '../api/contracts.ts';
import type { ClariprintQuoteGateway } from './clariprint-quote-gateway.ts';

export class ClariprintService {
  constructor(private readonly gateway: ClariprintQuoteGateway) {}
  quote(command: ClariprintQuoteCommand): Promise<ClariprintQuoteResult> { return this.gateway.quote(command); }
}
