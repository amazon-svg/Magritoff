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
 * serialise en RFC 7807 par `toHttpError()` (src/server/api/orders-routes.ts).
 * Le texte brut sous-jacent utilise le tiret bas ('order_not_found: <uuid>',
 * 'permission_denied: ...', 'transition_not_allowed: <from> -> <to>'),
 * jamais l'espace de l'ancien RPC. La classification (code metier prefere au
 * texte, compatibilite avec les deux formes) est mutualisee dans le module
 * neutre `orderTransitionErrors.helpers.ts` (qa-review round 2, 2026-09-16,
 * dette D3b) — importe aussi par `orderValidation.helpers.ts`, qui a le meme
 * defaut.
 */

import { getStatusLabelLowerFirst } from '@/modules/orders/ui/helpers/orderStatus';
import {
  isOrderNotFound,
  isOrderNotEditable,
  isPermissionDenied,
  isTransitionConflict,
  type RpcLikeError,
} from '@/modules/orders/ui/storefront/orderTransitionErrors.helpers';

export function formatCancelErrorMessage(err: RpcLikeError | null | undefined): string {
  const msg = String(err?.message ?? '').toLowerCase();

  if (msg.includes('authentication required') || msg.includes('auth.uid()')) {
    return 'Votre session a expire. Reconnectez-vous puis reessayez.';
  }
  if (isOrderNotFound(err, msg)) {
    return "Cette commande n'existe plus (peut-etre supprimee dans une autre fenetre).";
  }
  if (isPermissionDenied(err, msg)) {
    return "Vous n'avez pas les droits pour annuler cette commande. Seul le createur ou un administrateur tenant peut le faire.";
  }
  if (isOrderNotEditable(err, msg)) {
    // Meme texte que useStorefrontOrderEditor.ts (edition du brouillon) —
    // non atteignable aujourd'hui par ce flux (cf. commentaire dans
    // orderTransitionErrors.helpers.ts), traite par defense.
    return "Cette commande n'est plus modifiable (elle a peut-être été validée). Rechargez la page.";
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
