/**
 * BCP-0b — `SupabaseClariprintQuoteMembershipGateway`.
 *
 * qa-review round 1 (défauts T7/T8) : figer par un test ce que ce fichier
 * fait DÉJÀ (décision documentée dans le story doc, point 2) — une erreur
 * RPC est un échec FERMÉ pour toute la requête (`ClariprintQuoteBudget
 * UnavailableError` propagée), JAMAIS un repli silencieux en "non membre".
 * Sans ce test, une mutation qui avalerait l'erreur (`catch { return
 * false; }`) traiterait un membre en panne de base comme un visiteur sans
 * qu'aucun test ne le voie.
 */
import { describe, expect, it } from 'vitest';
import { SupabaseClariprintQuoteMembershipGateway } from '@/adapters/supabase/clariprint-quote-membership-gateway';
import { ClariprintQuoteBudgetUnavailableError } from '@/modules/clariprint/application/clariprint-quote-budget';

function fakeClient(rpcResult: { data: unknown; error: { message: string } | null }) {
  return {
    rpc: async (fn: string) => {
      expect(fn).toBe('current_user_tenant_ids');
      return rpcResult;
    },
  };
}

describe('SupabaseClariprintQuoteMembershipGateway — échec fermé (qa-review T7/T8)', () => {
  it('T7/T8 — erreur RPC : propage ClariprintQuoteBudgetUnavailableError, JAMAIS "non membre" silencieux', async () => {
    const gateway = new SupabaseClariprintQuoteMembershipGateway(
      fakeClient({ data: null, error: { message: 'base injoignable' } }) as any,
    );
    await expect(gateway.isMember('user-1')).rejects.toThrow(ClariprintQuoteBudgetUnavailableError);
  });

  it('aucun espace (tableau vide) : "non membre", jamais une erreur', async () => {
    const gateway = new SupabaseClariprintQuoteMembershipGateway(
      fakeClient({ data: [], error: null }) as any,
    );
    await expect(gateway.isMember('user-1')).resolves.toBe(false);
  });

  it('au moins un espace : "membre"', async () => {
    const gateway = new SupabaseClariprintQuoteMembershipGateway(
      fakeClient({ data: ['11111111-1111-4111-8111-111111111111'], error: null }) as any,
    );
    await expect(gateway.isMember('user-1')).resolves.toBe(true);
  });

  it('réponse défensive (data null sans erreur) : "non membre", jamais une erreur', async () => {
    const gateway = new SupabaseClariprintQuoteMembershipGateway(
      fakeClient({ data: null, error: null }) as any,
    );
    await expect(gateway.isMember('user-1')).resolves.toBe(false);
  });
});
