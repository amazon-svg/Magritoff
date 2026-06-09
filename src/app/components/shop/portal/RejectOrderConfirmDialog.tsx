/**
 * RejectOrderConfirmDialog — modal Sally-validated pour le refus d'une
 * commande par un validateur workflow (Story S-ORDER-ROLES-3-UI Sprint 6+).
 *
 * Sémantique : le validateur N+1 ou validateur final refuse une commande
 * draft remontée vers lui. Conséquences :
 *  - Transition statut draft → cancelled via RPC transition_tenant_order_status
 *    avec reason capturée (champ obligatoire 10-500 char).
 *  - Notification Resend déclenchée vers l'auteur (notify_policy du rôle).
 *
 * Distinction avec CancelOrderConfirmDialog (Sprint 5) :
 *  - CancelOrder : auteur annule sa propre commande (self-service draft).
 *  - RejectOrder : validateur refuse la commande d'un autre (workflow).
 *  - Même RPC sous-jacent, microcopy + champ reason différents.
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

export interface RejectOrderConfirmDialogProps {
  orderId: string | null;
  orderShortId?: string;
  /**
   * Callback appelé quand l'user confirme. Reçoit le reason saisi.
   * Doit retourner une erreur (string) ou null.
   */
  onConfirm: (orderId: string, reason: string) => Promise<string | null>;
  onClose: () => void;
}

const REASON_MIN = 10;
const REASON_MAX = 500;

export function RejectOrderConfirmDialog({
  orderId,
  orderShortId,
  onConfirm,
  onClose,
}: RejectOrderConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = orderId !== null;
  const reasonLen = reason.trim().length;
  const reasonValid = reasonLen >= REASON_MIN && reasonLen <= REASON_MAX;

  async function handleConfirm() {
    if (!orderId || !reasonValid) return;
    setSubmitting(true);
    setError(null);
    const errMsg = await onConfirm(orderId, reason.trim());
    setSubmitting(false);
    if (errMsg) {
      setError(errMsg);
      return;
    }
    // Reset état avant fermeture pour usage suivant
    setReason('');
    onClose();
  }

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) {
      setReason('');
      setError(null);
      onClose();
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent data-testid={TEST_IDS.shop.orderRejectDialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>Refuser cette commande ?</AlertDialogTitle>
          <AlertDialogDescription>
            {orderShortId && (
              <>
                Commande <span className="font-mono">#{orderShortId}</span>.{' '}
              </>
            )}
            La commande passera en statut <strong>Annulée</strong> et l'auteur sera prévenu
            de votre refus avec la raison ci-dessous. L'opération est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-1.5 mt-2">
          <label
            htmlFor="order-reject-reason"
            className="font-mono uppercase text-ink-mute-2"
            style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
          >
            Motif du refus
          </label>
          <textarea
            id="order-reject-reason"
            data-testid={TEST_IDS.shop.orderRejectReasonInput}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            rows={3}
            maxLength={REASON_MAX}
            placeholder="Précisez la raison pour que l'auteur puisse ajuster sa commande…"
            className="px-2.5 py-2 border border-line rounded bg-paper text-ink resize-y"
            style={{ fontSize: '13px', lineHeight: 1.4 }}
          />
          <div
            className="font-mono text-ink-mute-2 text-right"
            style={{ fontSize: '10.5px', fontVariantNumeric: 'tabular-nums' }}
          >
            {reasonLen} / {REASON_MAX} caractères
            {reasonLen > 0 && reasonLen < REASON_MIN && (
              <span className="text-warn-fg ml-2">(minimum {REASON_MIN})</span>
            )}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="px-3 py-2 rounded bg-err-bg border border-err-fg/20 text-err-fg"
            style={{ fontSize: '12.5px', lineHeight: 1.45 }}
          >
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            data-testid={TEST_IDS.shop.orderRejectDialogCancel}
            disabled={submitting}
          >
            Garder
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid={TEST_IDS.shop.orderRejectDialogConfirm}
            disabled={submitting || !reasonValid}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-err-fg text-paper hover:bg-err-fg/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            {submitting ? 'Refus…' : 'Refuser la commande'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
