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
 * §8.25 lot 5 point 5.1(b)) : meme defaut que `orderCancellation.helpers.ts`
 * — le chemin actuel `POST /orders/{id}/transitions` renvoie un texte brut
 * en tiret bas (`order_not_found: <uuid>`, `permission_denied: ...`,
 * `transition_not_allowed: <from> -> <to>`), plus le texte espace de
 * l'ancien RPC. La classification est mutualisee dans le module neutre
 * `orderTransitionErrors.helpers.ts` (qa-review round 2, 2026-09-16, dette
 * D3b), partage avec `orderCancellation.helpers.ts`.
 */

import { getStatusLabelLowerFirst } from '@/modules/orders/ui/helpers/orderStatus';
import {
  isOrderNotFound,
  isOrderNotEditable,
  isPermissionDenied,
  isTransitionConflict,
  isUnverifiedPrices,
  type RpcLikeError,
} from '@/modules/orders/ui/storefront/orderTransitionErrors.helpers';

export type { RpcLikeError };

export function formatValidateErrorMessage(err: RpcLikeError | null | undefined): string {
  const msg = String(err?.message ?? '').toLowerCase();

  if (msg.includes('authentication required') || msg.includes('auth.uid()')) {
    return 'Votre session a expire. Reconnectez-vous puis reessayez.';
  }
  if (isOrderNotFound(err, msg)) {
    return "Cette commande n'existe plus (peut-etre supprimee dans une autre fenetre).";
  }
  if (isPermissionDenied(err, msg) && msg.includes('admin tenant')) {
    return "Seul un administrateur tenant peut valider une commande. Contactez l'administrateur.";
  }
  if (isPermissionDenied(err, msg)) {
    return "Vous n'avez pas les droits pour valider cette commande.";
  }
  if (isOrderNotEditable(err, msg)) {
    // Meme texte que useStorefrontOrderEditor.ts (edition du brouillon) —
    // non atteignable aujourd'hui par ce flux, traite par defense (cf.
    // orderTransitionErrors.helpers.ts).
    return "Cette commande n'est plus modifiable (elle a peut-être été validée). Rechargez la page.";
  }
  if (isTransitionConflict(err, msg)) {
    // BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1(c), qa-review) : le
    // libelle est tire de la table unique, jamais recopie a la main.
    return `Cette commande n'est plus ${getStatusLabelLowerFirst('draft')} (peut-etre deja validee ou annulee).`;
  }
  // Q17-c (point 12 (c)) — repli defensif : la confirmation nommee acquitte
  // deja ce refus dans le cas nominal ; s il atteint quand meme l ecran,
  // c est que l etat affiche a change entre le chargement et le clic.
  if (isUnverifiedPrices(err, msg)) {
    return 'Cette commande porte au moins une ligne dont le prix n a pas pu etre verifie. Rechargez la page puis validez a nouveau pour confirmer explicitement.';
  }
  if (msg.length > 0) {
    return `Erreur lors de la validation : ${err?.message}`;
  }
  return "Erreur reseau lors de la validation. Reessayez.";
}
