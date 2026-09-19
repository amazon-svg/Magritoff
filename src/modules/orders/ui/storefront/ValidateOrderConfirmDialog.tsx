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
 *
 * Q17-c (docs/api/CONVENTIONS.md §8.25 point 12 (c), (h)) — quand la
 * commande porte `hasUnverifiedPrices`, valider exige un GESTE DISTINCT
 * (« un second bouton, pas une case discrète ») qui NOMME les lignes
 * concernées. Le prop `order` (au lieu d un simple `orderId`) permet à ce
 * composant de lire `hasUnverifiedPrices` et `items[].priceOrigin` sans
 * appel réseau supplémentaire : ces deux champs remontent déjà par
 * `listPortalOrders`/`listTenantOrders` (Q17-a → façade → OrderUI).
 */

import { useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
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
import { getStatusInfo } from '@/modules/orders/ui/helpers/orderStatus';
import type { OrderUI } from '@/modules/orders/ui/storefront/PortalOrders.helpers';

export interface ValidateOrderConfirmDialogProps {
  order: OrderUI | null;
  onConfirm: (orderId: string, acknowledgeUnverifiedPrices: boolean) => Promise<string | null>;
  onClose: () => void;
}

/**
 * Point 12 (c) : seules les lignes `client_unverified` bloquent la
 * transition (une ligne `legacy` ne l a jamais fait — point 12 (g)) ; ce sont
 * donc elles qu il faut NOMMER dans la confirmation. Fonction pure exportée
 * pour être testée sans rendu React (pattern déjà en place dans ce dépôt —
 * voir `showsUnverifiedPriceBadge`/`describePriceOrigin` de OrderHistoryTable.tsx).
 */
export function unverifiedLineNamesOf(order: Pick<OrderUI, 'items'> | null): string[] {
  return (order?.items ?? [])
    .filter((item) => item.priceOrigin === 'client_unverified')
    .map((item) => item.name);
}

/**
 * Q17-c (qa-review round 1, BLOQUANT 2) — l acquittement transmis a `onConfirm`
 * doit dependre de L ETAT REEL de la commande, jamais d une valeur figee. Cette
 * fonction est le SEUL endroit qui decide ce booleen ; `handleConfirm` ne fait
 * que la relayer (`onConfirm(orderId, acknowledgementFor(order))`), pour qu une
 * mutation qui fige ce booleen a `true` change la SIGNATURE de l appel, pas
 * seulement une valeur interne difficile a isoler par un test de comportement.
 */
export function acknowledgementFor(order: Pick<OrderUI, 'hasUnverifiedPrices'> | null): boolean {
  return order?.hasUnverifiedPrices === true;
}

export function ValidateOrderConfirmDialog({
  order,
  onConfirm,
  onClose,
}: ValidateOrderConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = order !== null;
  const orderId = order?.id ?? null;
  const orderShortId = order?.id ? order.id.replace(/-/g, '').slice(0, 8).toUpperCase() : undefined;
  const hasUnverifiedPrices = acknowledgementFor(order);
  const unverifiedLineNames = unverifiedLineNamesOf(order);

  async function handleConfirm() {
    if (!orderId) return;
    setSubmitting(true);
    setError(null);
    const errMsg = await onConfirm(orderId, acknowledgementFor(order));
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
            La commande passera de <strong>{getStatusInfo('draft').label}</strong> à{' '}
            <strong>{getStatusInfo('validated').label}</strong>. Elle pourra alors être renouvelée par l'acheteur
            et entrera dans le pipeline de production. L'événement est tracé dans
            l'historique.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasUnverifiedPrices && (
          <div
            data-testid={TEST_IDS.shop.validateOrderDialogUnverifiedNotice}
            className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-warn-bg border border-warn-fg/20 text-warn-fg"
            style={{ fontSize: '12.5px', lineHeight: 1.5 }}
          >
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>
              Le serveur n a pas pu vérifier le prix{' '}
              {unverifiedLineNames.length > 1 ? 'des lignes suivantes' : 'de la ligne suivante'} :{' '}
              <strong>
                {unverifiedLineNames.length > 0 ? unverifiedLineNames.join(', ') : 'au moins une ligne de cette commande'}
              </strong>
              . Valider quand même acquitte explicitement ce risque, et l'événement le tracera avec votre nom.
            </span>
          </div>
        )}

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
            data-testid={
              hasUnverifiedPrices
                ? TEST_IDS.shop.validateOrderDialogConfirmUnverified
                : TEST_IDS.shop.validateOrderDialogConfirm
            }
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className={hasUnverifiedPrices ? 'bg-warn-fg text-paper hover:bg-warn-fg/90' : 'bg-ok-fg text-paper hover:bg-ok-fg/90'}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            {submitting
              ? 'Validation…'
              : hasUnverifiedPrices
                ? 'Valider malgré les prix non vérifiés'
                : 'Valider la commande'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
