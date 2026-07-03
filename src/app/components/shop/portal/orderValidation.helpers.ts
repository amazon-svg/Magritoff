/**
 * Helpers purs pour la validation de commande draft → validated (Story
 * S-VALIDATE-DRAFT-MVP, Sprint 5, anticipation partielle S-N1-APPROVAL).
 *
 * Map les erreurs RPC `public.update_tenant_order_status` (transition
 * draft → validated, réservée admin tenant) en messages utilisateur lisibles.
 *
 * Cf. matrice RPC migration 20260509000100_e1_orders_v1_1.sql L247-249 :
 *   draft → validated : admin tenant uniquement (role in 'owner','admin')
 */

export interface RpcLikeError {
  message?: string;
  code?: string;
  details?: string;
}

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
  if (msg.includes('transition') && msg.includes('not allowed')) {
    return "Cette commande n'est plus en statut Brouillon (peut-etre deja validee ou annulee).";
  }
  if (msg.length > 0) {
    return `Erreur lors de la validation : ${err?.message}`;
  }
  return "Erreur reseau lors de la validation. Reessayez.";
}
