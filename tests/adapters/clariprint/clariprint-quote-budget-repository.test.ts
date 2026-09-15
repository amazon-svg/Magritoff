/**
 * BCP-0b — `SupabaseClariprintQuoteBudgetRepository`.
 *
 * qa-review round 1 : les mutations T7 (erreur RPC), T7b (réponse vide) et
 * T7c (portée de refus inconnue) survivaient — aucun test n'exerçait le
 * chemin d'ADAPTATION lui-même (les tests de route ne passent JAMAIS par
 * cet adaptateur, ils fournissent un `ClariprintQuoteBudget` factice). Ce
 * fichier ferme le trou : chaque cas d'erreur/silence côté RPC doit
 * produire une INDISPONIBILITÉ (échec fermé), jamais une autorisation.
 */
import { describe, expect, it } from 'vitest';
import { SupabaseClariprintQuoteBudgetRepository } from '@/adapters/supabase/clariprint-quote-budget-repository';
import { ClariprintQuoteBudgetUnavailableError } from '@/modules/clariprint/application/clariprint-quote-budget';

function fakeClient(rpcResult: { data: unknown; error: { message: string } | null }) {
  return {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      expect(fn).toBe('api_consume_clariprint_quote_budget');
      expect(params).toEqual({ p_caller_kind: 'visitor', p_key_hash: 'ip:deadbeef' });
      return rpcResult;
    },
  };
}

const CALLER = { kind: 'visitor' as const, key: 'ip:deadbeef' };

describe('SupabaseClariprintQuoteBudgetRepository — échec fermé (qa-review T7/T7b/T7c)', () => {
  it('T7 — erreur RPC : indisponible, JAMAIS allowed:true', async () => {
    const repository = new SupabaseClariprintQuoteBudgetRepository(
      fakeClient({ data: null, error: { message: 'connexion refusée' } }) as any,
    );
    await expect(repository.consume(CALLER)).rejects.toThrow(ClariprintQuoteBudgetUnavailableError);
  });

  it('T7b — réponse vide (tableau vide) : indisponible, JAMAIS allowed:true', async () => {
    const repository = new SupabaseClariprintQuoteBudgetRepository(
      fakeClient({ data: [], error: null }) as any,
    );
    await expect(repository.consume(CALLER)).rejects.toThrow(ClariprintQuoteBudgetUnavailableError);
  });

  it('T7b — réponse vide (null) : indisponible, JAMAIS allowed:true', async () => {
    const repository = new SupabaseClariprintQuoteBudgetRepository(
      fakeClient({ data: null, error: null }) as any,
    );
    await expect(repository.consume(CALLER)).rejects.toThrow(ClariprintQuoteBudgetUnavailableError);
  });

  it('T7c — portée de refus inconnue (allowed:false, refused_scope non reconnu) : indisponible, JAMAIS allowed:true', async () => {
    const repository = new SupabaseClariprintQuoteBudgetRepository(
      fakeClient({ data: [{ allowed: false, refused_scope: 'clariprint_quote_inexistante' }], error: null }) as any,
    );
    await expect(repository.consume(CALLER)).rejects.toThrow(ClariprintQuoteBudgetUnavailableError);
  });

  it('T7c — refus SANS portée (allowed:false, refused_scope null) : indisponible, JAMAIS allowed:true', async () => {
    const repository = new SupabaseClariprintQuoteBudgetRepository(
      fakeClient({ data: [{ allowed: false, refused_scope: null }], error: null }) as any,
    );
    await expect(repository.consume(CALLER)).rejects.toThrow(ClariprintQuoteBudgetUnavailableError);
  });

  it('témoin positif — allowed:true est bien rendu tel quel (le repli fermé ne masque pas le cas normal)', async () => {
    const repository = new SupabaseClariprintQuoteBudgetRepository(
      fakeClient({ data: [{ allowed: true, refused_scope: null }], error: null }) as any,
    );
    await expect(repository.consume(CALLER)).resolves.toEqual({ allowed: true });
  });

  it('témoin positif — les trois portées connues sont mappées correctement', async () => {
    const cases: ReadonlyArray<readonly [string, 'visitor' | 'member' | 'public']> = [
      ['clariprint_quote_visitor', 'visitor'],
      ['clariprint_quote_member', 'member'],
      ['clariprint_quote_public_daily', 'public'],
    ];
    for (const [dbScope, expected] of cases) {
      const repository = new SupabaseClariprintQuoteBudgetRepository(
        fakeClient({ data: [{ allowed: false, refused_scope: dbScope }], error: null }) as any,
      );
      await expect(repository.consume(CALLER)).resolves.toEqual({ allowed: false, refusedScope: expected });
    }
  });
});
