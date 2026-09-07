/**
 * StorefrontQuoteDecisionConfirmDialog — modal de confirmation pour la
 * decision du client sur un devis (E10.10b-2).
 *
 * Meme patron que `CancelOrderConfirmDialog` (E10 storefront) : AlertDialog
 * shadcn (Radix), focus trap + aria-modal + Esc nativement, action irrever-
 * sible confirmee explicitement, erreur affichee SANS fermer le modal (retry
 * possible, notamment sur 409 `api.resource_conflict` — le client peut relire
 * le devis puis rejouer).
 *
 * AUCUN calcul ni AUCUNE garde metier ici : `onConfirm` porte l appel API
 * complet (`decide()`), ce composant n est qu une confirmation d intention.
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
} from '@/shared/ui/alert-dialog';
import { TEST_IDS } from '@/shared/presentation/testIds';
import type { StorefrontQuoteDecision } from '@/modules/storefront-quotes';

export interface PendingStorefrontQuoteDecision {
  quoteId: string;
  /** Numero metier affiche pour confirmation visuelle (ex. DEV-2026-00042). */
  number: string;
  decision: StorefrontQuoteDecision;
}

export interface StorefrontQuoteDecisionConfirmDialogProps {
  /** `null` = modal ferme. */
  pending: PendingStorefrontQuoteDecision | null;
  /** Appelle DEJA `decide()` avec le quoteId/decision/etag captures par l appelant. Rend une erreur (string) ou null. */
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}

const DECISION_COPY: Readonly<
  Record<StorefrontQuoteDecision, Readonly<{ title: string; action: string; actionPending: string; consequence: string }>>
> = {
  accepted: {
    title: 'Accepter ce devis ?',
    action: 'Accepter le devis',
    actionPending: 'Acceptation…',
    consequence: "Cette action passera le devis en statut Accepté. Elle est irréversible : votre imprimeur vous adressera un nouveau devis si vous changez d'avis.",
  },
  rejected: {
    title: 'Refuser ce devis ?',
    action: 'Refuser le devis',
    actionPending: 'Refus…',
    consequence: "Cette action passera le devis en statut Refusé. Elle est irréversible : votre imprimeur vous adressera un nouveau devis si vous changez d'avis.",
  },
};

export function StorefrontQuoteDecisionConfirmDialog({
  pending,
  onConfirm,
  onClose,
}: StorefrontQuoteDecisionConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = pending !== null;
  const copy = pending ? DECISION_COPY[pending.decision] : null;

  async function handleConfirm() {
    if (!pending) return;
    setSubmitting(true);
    setError(null);
    const errMsg = await onConfirm();
    setSubmitting(false);
    if (errMsg) {
      setError(errMsg);
      // Garde le modal ouvert : l erreur peut se resoudre par un retry
      // (conflit de version, notamment) sans ressaisir l intention du client.
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
      <AlertDialogContent data-testid={TEST_IDS.shop.accountQuoteDecisionConfirmModal}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {pending && (
              <>
                Devis <span className="font-mono">{pending.number}</span>.{' '}
              </>
            )}
            {copy?.consequence}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div
            role="alert"
            data-testid={TEST_IDS.shop.accountQuoteDecisionError}
            className="px-3 py-2 rounded bg-err-bg border border-err-fg/20 text-err-fg"
            style={{ fontSize: '12.5px', lineHeight: 1.45 }}
          >
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel data-testid={TEST_IDS.shop.accountQuoteDecisionCancelBtn} disabled={submitting}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid={TEST_IDS.shop.accountQuoteDecisionConfirmBtn}
            disabled={submitting}
            onClick={(event) => {
              // Empeche AlertDialog Radix de fermer automatiquement — la
              // fermeture est controlee par handleConfirm si l appel reussit.
              event.preventDefault();
              void handleConfirm();
            }}
            className={
              pending?.decision === 'rejected'
                ? 'bg-err-fg text-paper hover:bg-err-fg/90'
                : undefined
            }
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            {submitting ? copy?.actionPending : copy?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
