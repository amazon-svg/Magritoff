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
 */

export interface RpcLikeError {
  message?: string;
  code?: string;
  details?: string;
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
  if (msg.includes('transition') && msg.includes('not allowed')) {
    return "Cette commande n'est plus en statut Brouillon (peut-etre validee ou annulee dans une autre fenetre).";
  }
  if (msg.length > 0) {
    return `Erreur lors de l'annulation : ${err?.message}`;
  }
  return 'Erreur reseau lors de l\'annulation. Reessayez.';
}
