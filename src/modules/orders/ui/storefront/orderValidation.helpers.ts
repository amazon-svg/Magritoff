/**
 * Helpers purs pour la validation de commande draft → validated (Story
 * S-VALIDATE-DRAFT-MVP, Sprint 5, anticipation partielle S-N1-APPROVAL).
 *
 * Map les erreurs RPC `public.update_tenant_order_status` (transition
 * draft → validated, réservée admin tenant) en messages utilisateur lisibles.
 *
 * Cf. matrice RPC migration 20260509000100_e1_orders_v1_1.sql L247-249 :
 *   draft → validated : admin tenant uniquement (role in 'owner','admin')
 *
 * Fix BCP-5/BCP-6 (recette navigateur 2026-09-15/16, docs/api/CONVENTIONS.md
 * §8.25 lot 5 point 5.1(b)) : meme defaut que `formatCancelErrorMessage`
 * (orderCancellation.helpers.ts) — le chemin actuel `POST
 * /orders/{id}/transitions` renvoie `transition_not_allowed: <from> -> <to>`
 * (tiret bas), plus le texte de l'ancien RPC ('not allowed', espace). La
 * detection du conflit est mutualisee via `isTransitionConflict()`.
 */

import { getStatusLabelLowerFirst } from '@/modules/orders/ui/helpers/orderStatus';
import { isTransitionConflict, type RpcLikeError } from '@/modules/orders/ui/storefront/orderCancellation.helpers';

export type { RpcLikeError };

export function formatValidateErrorMessage(err: RpcLikeError | null | undefined): string {
  const msg = String(err?.message ?? '').toLowerCase();

  if (msg.includes('authentication required') || msg.includes('auth.uid()')) {
    return 'Votre session a expire. Reconnectez-vous puis reessayez.';
  }
  if (msg.includes('not found')) {
    return "Cette commande n'existe plus (peut-etre supprimee dans une autre fenetre).";
  }
  if (msg.includes('permission denied') && msg.includes('admin tenant')) {
    return "Seul un administrateur tenant peut valider une commande. Contactez l'administrateur.";
  }
  if (msg.includes('permission denied')) {
    return "Vous n'avez pas les droits pour valider cette commande.";
  }
  if (isTransitionConflict(err, msg)) {
    // BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1(c), qa-review) : le
    // libelle est tire de la table unique, jamais recopie a la main.
    return `Cette commande n'est plus ${getStatusLabelLowerFirst('draft')} (peut-etre deja validee ou annulee).`;
  }
  if (msg.length > 0) {
    return `Erreur lors de la validation : ${err?.message}`;
  }
  return "Erreur reseau lors de la validation. Reessayez.";
}
