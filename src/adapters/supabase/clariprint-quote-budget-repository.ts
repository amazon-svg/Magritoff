import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ClariprintQuoteBudgetUnavailableError,
  type ClariprintQuoteBudget,
  type ClariprintQuoteBudgetDecision,
  type ClariprintQuoteBudgetRefusal,
  type ClariprintQuoteCaller,
} from '../../modules/clariprint/application/clariprint-quote-budget.ts';

/** Nom SQL de la portée (migration `20260915000100`) -> nom court côté TS. */
const REFUSED_SCOPE_BY_DB_SCOPE: Readonly<Record<string, ClariprintQuoteBudgetRefusal>> = Object.freeze({
  clariprint_quote_visitor: 'visitor',
  clariprint_quote_member: 'member',
  clariprint_quote_public_daily: 'public',
});

/**
 * BCP-0b — consommation atomique du budget de débit sur la route historique
 * `POST /api/v1/clariprint/quote` (docs/api/CONVENTIONS.md §8.25 point
 * 2.3bis (2) et (8)). Appelle TOUJOURS `api_consume_clariprint_quote_budget`
 * par le client `service_role` (seul grant `EXECUTE`, migration
 * `20260915000100_bcp_0b_clariprint_rate_limit.sql`) : c'est le même client
 * que `magrit-api/index.ts` compose déjà pour l'outbox.
 *
 * Une erreur ICI (base injoignable, réponse illisible) est un échec FERMÉ :
 * `ClariprintQuoteBudgetUnavailableError` propagée, jamais un passage en
 * silence — le service appelant (`ClariprintService.quote`) n'appelle
 * Clariprint qu'après un `consume()` qui a RENDU une décision, jamais après
 * une exception.
 */
export class SupabaseClariprintQuoteBudgetRepository implements ClariprintQuoteBudget {
  constructor(private readonly serviceRoleClient: SupabaseClient<any>) {}

  async consume(caller: ClariprintQuoteCaller): Promise<ClariprintQuoteBudgetDecision> {
    const { data, error } = await this.serviceRoleClient.rpc('api_consume_clariprint_quote_budget', {
      p_caller_kind: caller.kind,
      p_key_hash: caller.key,
    });
    if (error) {
      throw new ClariprintQuoteBudgetUnavailableError(`clariprint_quote_budget_call_failed: ${error.message}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | Readonly<{ allowed: boolean; refused_scope: string | null }>
      | null
      | undefined;
    if (!row) throw new ClariprintQuoteBudgetUnavailableError('clariprint_quote_budget_empty_response');
    if (row.allowed) return { allowed: true };

    const refusedScope = row.refused_scope ? REFUSED_SCOPE_BY_DB_SCOPE[row.refused_scope] : undefined;
    if (!refusedScope) throw new ClariprintQuoteBudgetUnavailableError('clariprint_quote_budget_unknown_scope');
    return { allowed: false, refusedScope };
  }
}
