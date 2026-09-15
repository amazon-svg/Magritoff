import type { SupabaseClient } from '@supabase/supabase-js';
import { ClariprintQuoteBudgetUnavailableError } from '../../modules/clariprint/application/clariprint-quote-budget.ts';

/**
 * BCP-0b — détermine si l'appelant appartient à au moins un espace,
 * EXACTEMENT par la fonction que les policies RLS emploient
 * (`current_user_tenant_ids`) — docs/api/CONVENTIONS.md §8.25 point
 * 2.3bis (4) : "la route et la base ne peuvent pas être en désaccord".
 *
 * Le client injecté PORTE le JWT de l'appelant (celui composé par
 * `magrit-api/index.ts` avec l'`Authorization` de la requête, jamais le
 * `service_role`) : c'est ce qui permet à `current_user_tenant_ids()` de
 * résoudre `auth.uid()` sur le BON utilisateur, sans avoir à lui faire
 * confiance sur un identifiant transmis en clair.
 *
 * Une erreur ICI (base injoignable) est un échec FERMÉ pour toute la
 * requête (point 2.3bis (3)) : elle est donc PROPAGÉE en
 * `ClariprintQuoteBudgetUnavailableError` (503 `clariprint.unavailable`),
 * jamais avalée en "non membre" — sinon un attaquant pourrait provoquer une
 * panne de la vérification pour se faire traiter en visiteur à volonté, et
 * un vrai membre en panne de base perdrait son étage sans le savoir.
 */
export class SupabaseClariprintQuoteMembershipGateway {
  constructor(private readonly client: SupabaseClient<any>) {}

  /**
   * `_userId` n'est PAS transmis à la requête : `current_user_tenant_ids()`
   * ne connaît que l'utilisateur du JWT porté par `this.client`, qui est
   * garanti être le même (même flux de résolution d'acteur, dans
   * `magrit-api/index.ts`). Conservé dans la signature pour la lisibilité
   * de l'appelant et la testabilité (un faux peut varier sa réponse par
   * utilisateur sans dépendre de ce détail d'implémentation).
   */
  async isMember(_userId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('current_user_tenant_ids');
    if (error) {
      throw new ClariprintQuoteBudgetUnavailableError(`clariprint_quote_membership_check_failed: ${error.message}`);
    }
    return Array.isArray(data) && data.length > 0;
  }
}
