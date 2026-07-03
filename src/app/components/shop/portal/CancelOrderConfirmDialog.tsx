/**
 * CancelOrderConfirmDialog — modal de confirmation Sally-validated pour
 * l'annulation d'une commande draft (Story S3.4 Sprint 5).
 *
 * Utilise AlertDialog shadcn (Radix sous le capot) → focus trap +
 * aria-modal + Esc nativement (a11y AC10).
 *
 * UX :
 *  - Safe par defaut : "Garder" a le focus initial
 *  - Action danger explicite : "Annuler la commande" (variant destructive)
 *  - Affichage du short ID pour confirmation visuelle (eviter erreur cible)
 *  - Affichage erreur post-RPC sans fermer le modal (laisser l'user retry)
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import { TEST_IDS } from '../../../lib/testIds';

export interface CancelOrderConfirmDialogProps {
  /** UUID de la commande à annuler, ou null si modal fermé. */
  orderId: string | null;
  /** Short ID affiché pour confirmation visuelle (ex: 'A1B2C3D4'). */
  orderShortId?: string;
  /** Callback appelé quand l'user confirme. Doit retourner une erreur (string) ou null. */
  onConfirm: (orderId: string) => Promise<string | null>;
  /** Callback pour fermer le modal (reset orderId à null côté parent). */
  onClose: () => void;
}

export function CancelOrderConfirmDialog({
  orderId,
  orderShortId,
  onConfirm,
  onClose,
}: CancelOrderConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = orderId !== null;

  async function handleConfirm() {
    if (!orderId) return;
    setSubmitting(true);
    setError(null);
    const errMsg = await onConfirm(orderId);
    setSubmitting(false);
    if (errMsg) {
      setError(errMsg);
      // Garde le modal ouvert pour permettre retry ou fermeture manuelle
      return;
    }
    onClose();
  }

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) {
      setError(null);
      onClose();
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent data-testid={TEST_IDS.shop.cancelOrderDialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>Annuler cette commande ?</AlertDialogTitle>
          <AlertDialogDescription>
            {orderShortId && (
              <>
                Commande <span className="font-mono">#{orderShortId}</span>.{' '}
              </>
            )}
            Cette action passera la commande en statut <strong>Annulée</strong> et tracera
            l'événement dans l'historique. L'opération est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div
            role="alert"
            data-testid={TEST_IDS.shop.cancelOrderDialogError}
            className="px-3 py-2 rounded bg-err-bg border border-err-fg/20 text-err-fg"
            style={{ fontSize: '12.5px', lineHeight: 1.45 }}
          >
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            data-testid={TEST_IDS.shop.cancelOrderDialogKeep}
            disabled={submitting}
          >
            Garder
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid={TEST_IDS.shop.cancelOrderDialogConfirm}
            disabled={submitting}
            onClick={(e) => {
              // Empêche AlertDialog Radix de fermer automatiquement —
              // on contrôle la fermeture via handleConfirm si OK.
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-err-fg text-paper hover:bg-err-fg/90"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            {submitting ? 'Annulation…' : 'Annuler la commande'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
