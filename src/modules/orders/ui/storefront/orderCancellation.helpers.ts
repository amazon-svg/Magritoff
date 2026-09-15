/**
 * Helpers purs pour l'annulation de commande draft (Story S3.4 Sprint 5).
 *
 * Le helper principal `formatCancelErrorMessage` traduit les patterns d'erreur
 * remontes par le RPC `public.update_tenant_order_status` en messages
 * utilisateur lisibles. Pure function pour testabilite vitest.
 *
 * RPC patterns d'erreur connus (cf. migration 20260509000100_e1_orders_v1_1.sql) :
 *   - 'Authentication required' → utilisateur deconnecte
 *   - 'Tenant order ... not found' → race condition delete cote autre session
 *   - 'Permission denied: cancel requires owner or admin tenant' → can_order ok
 *     mais l'utilisateur n'est ni le createur ni admin tenant
 *   - 'Transition draft -> cancelled not allowed in v1.1' → la commande n'est
 *     plus en draft (race condition cote autre session)
 *
 * Fix BCP-5/BCP-6 (recette navigateur 2026-09-15/16, docs/api/CONVENTIONS.md
 * §8.25 lot 5 point 5.1) : le chemin actuel `POST /orders/{id}/transitions`
 * (src/modules/orders/api/client.ts) ne passe plus par le RPC ci-dessus mais
 * par `OrderCommandRejectedError` (src/modules/orders/application/orders-repository.ts),
 * serialise en RFC 7807 par `toHttpError()` (src/server/api/orders-routes.ts) :
 * `code: 'orders.transition_not_allowed'`, `detail: 'transition_not_allowed:
 * <from> -> <to>'` (tiret bas, pas d'espace). Le pattern-matching texte ci-
 * dessous ne reconnaissait que l'ancienne forme ('not allowed' avec espace),
 * laissant fuiter le texte technique. `toRpcLikeError()` privilegie desormais
 * le code stable (`ApiClientError.problem.code`) quand il est disponible.
 */

import { ApiClientError } from '@/platform/api';
import { getStatusLabelLowerFirst } from '@/modules/orders/ui/helpers/orderStatus';

export interface RpcLikeError {
  message?: string;
  code?: string;
  details?: string;
}

/**
 * Convertit une erreur catchee (typiquement `ApiClientError` du client API,
 * ou une `Error` generique) en `RpcLikeError` exploitable par
 * `formatCancelErrorMessage`/`formatValidateErrorMessage`.
 *
 * `ApiClientError` ne porte pas de `.code` de premier niveau : le code
 * metier stable RFC 7807 vit dans `.problem.code` (construit par
 * `toHttpError()` dans src/server/api/orders-routes.ts, ex.
 * 'orders.transition_not_allowed'). On l'expose ici pour que les helpers de
 * formatage puissent preferer le code au texte, plus robuste qu'un pattern-
 * matching sur `error.message` — celui-ci a change de forme entre l'ancien
 * RPC ('not allowed', avec espace) et la route actuelle ('not_allowed',
 * avec tiret bas).
 */
export function toRpcLikeError(cause: unknown): RpcLikeError | null {
  if (cause instanceof ApiClientError) {
    return { message: cause.message, code: cause.problem.code };
  }
  if (cause instanceof Error) return { message: cause.message };
  return null;
}

/**
 * Reconnait un conflit de transition (commande deja transitionnee ailleurs)
 * sous ses deux formes connues :
 *  - le code metier stable de la route actuelle ('orders.transition_not_allowed') ;
 *  - le texte brut, sous sa forme actuelle ('transition_not_allowed: from -> to',
 *    tiret bas) ou sous l'ancienne forme RPC ('Transition ... not allowed', espace).
 */
export function isTransitionConflict(err: RpcLikeError | null | undefined, msg: string): boolean {
  if (String(err?.code ?? '').toLowerCase() === 'orders.transition_not_allowed') return true;
  if (!msg.includes('transition')) return false;
  return msg.includes('not_allowed') || msg.includes('not allowed');
}

export function formatCancelErrorMessage(err: RpcLikeError | null | undefined): string {
  const msg = String(err?.message ?? '').toLowerCase();

  if (msg.includes('authentication required') || msg.includes('auth.uid()')) {
    return 'Votre session a expire. Reconnectez-vous puis reessayez.';
  }
  if (msg.includes('not found')) {
    return "Cette commande n'existe plus (peut-etre supprimee dans une autre fenetre).";
  }
  if (msg.includes('permission denied')) {
    return "Vous n'avez pas les droits pour annuler cette commande. Seul le createur ou un administrateur tenant peut le faire.";
  }
  if (isTransitionConflict(err, msg)) {
    // BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1(c), qa-review) : le
    // libelle est tire de la table unique, jamais recopie a la main.
    return `Cette commande n'est plus ${getStatusLabelLowerFirst('draft')} (peut-etre validee ou annulee dans une autre fenetre).`;
  }
  if (msg.length > 0) {
    return `Erreur lors de l'annulation : ${err?.message}`;
  }
  return 'Erreur reseau lors de l\'annulation. Reessayez.';
}
