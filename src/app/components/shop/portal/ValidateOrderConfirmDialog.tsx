/**
 * ValidateOrderConfirmDialog — modal de confirmation pour la validation
 * d'une commande draft → validated par un admin tenant (Sprint 5, fix
 * 2026-05-25, anticipation partielle S-N1-APPROVAL Sprint 6).
 *
 * Pattern identique à CancelOrderConfirmDialog (S3.4) avec :
 *  - texte adapté à la validation (action positive vs danger)
 *  - bouton confirm style primaire (pas danger rouge)
 *  - focus initial sur "Annuler" (safe par défaut — pas auto-validation
 *    accidentelle)
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

export interface ValidateOrderConfirmDialogProps {
  orderId: string | null;
  orderShortId?: string;
  onConfirm: (orderId: string) => Promise<string | null>;
  onClose: () => void;
}

export function ValidateOrderConfirmDialog({
  orderId,
  orderShortId,
  onConfirm,
  onClose,
}: ValidateOrderConfirmDialogProps) {
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
      <AlertDialogContent data-testid={TEST_IDS.shop.validateOrderDialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>Valider cette commande ?</AlertDialogTitle>
          <AlertDialogDescription>
            {orderShortId && (
              <>
                Commande <span className="font-mono">#{orderShortId}</span>.{' '}
              </>
            )}
            La commande passera du statut <strong>Brouillon</strong> à{' '}
            <strong>Validée</strong>. Elle pourra alors être renouvelée par l'acheteur
            et entrera dans le pipeline de production. L'événement est tracé dans
            l'historique.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div
            role="alert"
            data-testid={TEST_IDS.shop.validateOrderDialogError}
            className="px-3 py-2 rounded bg-err-bg border border-err-fg/20 text-err-fg"
            style={{ fontSize: '12.5px', lineHeight: 1.45 }}
          >
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            data-testid={TEST_IDS.shop.validateOrderDialogKeep}
            disabled={submitting}
          >
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid={TEST_IDS.shop.validateOrderDialogConfirm}
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-ok-fg text-paper hover:bg-ok-fg/90"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            {submitting ? 'Validation…' : 'Valider la commande'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
