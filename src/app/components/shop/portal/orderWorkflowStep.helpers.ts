/**
 * Helper fire-and-forget pour déclencher l'edge function order-workflow-step
 * après succès d'une transition de statut commande (S-N1-APPROVAL).
 *
 * Pattern fire-and-forget : ne bloque jamais l'UI, ne remonte jamais
 * d'erreur côté caller. Les échecs Resend sont loggés via console.warn
 * + tracés dans la réponse JSON de l'edge (mais on n'attend pas).
 *
 * Appelé depuis :
 *  - PortalOrders.handleCancelConfirm (acheteur self-service draft → cancelled)
 *  - DashboardOrders.handleCancelConfirm (admin tenant draft → cancelled)
 *  - DashboardOrders.handleValidateConfirm (admin tenant draft → validated)
 *  - (futur) PortalOrders refonte UI tabs (S-ORDER-ROLES-3-UI) pour Valider /
 *    Annuler par les rôles non-admin via capability
 */

import { supabase } from '/utils/supabase/client';

export interface WorkflowStepArgs {
  orderId: string;
  fromStatus: string;
  toStatus: string;
  actorUserId: string;
}

export function triggerOrderWorkflowStep(args: WorkflowStepArgs): void {
  // Fire-and-forget : on n'await pas, on ne bloque pas l'UI sur la
  // notification. Erreurs loggées en console.warn.
  void (async () => {
    try {
      const { error } = await supabase.functions.invoke('order-workflow-step', {
        body: {
          order_id: args.orderId,
          from_status: args.fromStatus,
          to_status: args.toStatus,
          actor_user_id: args.actorUserId,
          base_url: window.location.origin,
        },
      });
      if (error) {
        console.warn('[order-workflow-step] invoke error:', error.message ?? error);
      }
    } catch (err) {
      console.warn('[order-workflow-step] fire-and-forget threw:', err);
    }
  })();
}
