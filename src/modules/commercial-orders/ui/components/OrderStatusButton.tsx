/**
 * OrderStatusButton — POINT D APPEL reutilisable de `OrderStatusDialog`
 * (E10.14). N EXISTE QUE pour garantir la regle CA1/CA2 (« un seul
 * composant, deux points d appel, jamais deux implementations ») quand une
 * grille de commandes et une fiche commande existeront : les deux
 * n auront qu a monter CE bouton, jamais reimplementer l ouverture de la
 * modale.
 *
 * DETTE ASSUMEE, PAS UNE OMISSION : au 2026-09-09, ni la grille de commandes
 * (E10.16, non livree) ni la fiche commande (aucune story ne l a encore
 * posee) n existent dans ce depot. Ce composant n est donc CABLE NULLE PART
 * pour l instant — aucun ecran ne l importe. L inventer serait creer une
 * page hors backlog (regle absolue du projet, feedback_no_invent_hors_
 * backlog) ; le laisser IMPLEMENTE et PRET, en revanche, evite qu E10.16 ou
 * la premiere fiche commande aient a re-decouvrir ce contrat.
 */
import { useState } from 'react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import type { OrderStepChangeDto } from '@/modules/commercial-orders/api/contracts';
import { OrderStatusDialog } from './OrderStatusDialog';

const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink';

export interface OrderStatusButtonProps {
  orderId: string;
  label?: string;
  className?: string;
  onChanged?: (entry: OrderStepChangeDto) => void;
}

export function OrderStatusButton({ orderId, label = 'Statut', className, onChanged }: OrderStatusButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? btnGhost}
        data-testid={TEST_IDS.orderStatus.btn}
      >
        {label}
      </button>
      {open && (
        <OrderStatusDialog
          orderId={orderId}
          onClose={() => setOpen(false)}
          {...(onChanged === undefined ? {} : { onChanged })}
        />
      )}
    </>
  );
}
