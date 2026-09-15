import type { ClariprintQuoteCommand, ClariprintQuoteResult } from '../api/contracts.ts';
import { ClariprintQuoteRateLimitedError, type ClariprintQuoteBudget, type ClariprintQuoteCaller } from './clariprint-quote-budget.ts';
import type { ClariprintQuoteGateway } from './clariprint-quote-gateway.ts';

export class ClariprintService {
  constructor(
    private readonly gateway: ClariprintQuoteGateway,
    private readonly budget: ClariprintQuoteBudget,
  ) {}

  /**
   * BCP-0b — le budget est consulté APRÈS la validation du corps (déjà faite
   * par `defineJsonRoute` avant `handle()`) et AVANT la passerelle : un
   * refus lève `ClariprintQuoteRateLimitedError` et n'appelle JAMAIS
   * Clariprint (docs/api/CONVENTIONS.md §8.25 point 2.3bis (8)).
   */
  async quote(command: ClariprintQuoteCommand, caller: ClariprintQuoteCaller, requestId?: string): Promise<ClariprintQuoteResult> {
    const decision = await this.budget.consume(caller);
    if (!decision.allowed) throw new ClariprintQuoteRateLimitedError(decision.refusedScope);
    return this.gateway.quote(command, requestId);
  }
}
