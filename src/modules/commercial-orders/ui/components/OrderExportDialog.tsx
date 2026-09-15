/**
 * OrderExportDialog — modale de demande d export comptable des commandes
 * (E10.18e-2, docs/api/CONVENTIONS.md §8.24, consigne E10.18e-2, points 1 a
 * 4 et point 11).
 *
 * MONTAGE CONDITIONNEL PAR L APPELANT (`{open && <OrderExportDialog .../>}`),
 * meme patron que `OrderStatusButton`/`OrderStatusDialog` (E10.14) : le
 * montage EST l ouverture, le demontage EST la fermeture — pas de prop
 * `open` a lire en plus du cycle de vie React, pas de comparaison de valeur
 * precedente pendant le rendu.
 *
 * COQUILLE GENERIQUE (meme discipline que `OrdersListPage.tsx`, condition
 * (b1)/(11)) : l etat de la modale (`orderExportDialogReducer`), la
 * traduction filtres-de-grille -> filtres-d-export
 * (`buildOrderExportFilters`, MEME fonction/etat que la grille — voir
 * `order-export.helpers.ts`), la garde de double-clic
 * (`createOrderExportSubmitController`) sont PURS et TESTES. Ce fichier ne
 * fait que les PARCOURIR : `ORDER_EXPORT_FORMAT_OPTIONS`/`ORDER_EXPORT_
 * GRANULARITY_OPTIONS` pilotent les deux groupes de boutons radio, aucune
 * option n est ecrite a la main dans le JSX.
 *
 * Le TRI N EST PAS REPRIS (point (ii) du cadrage) — ce texte est affiche EN
 * CLAIR ici, jamais laisse a deviner.
 */
import { useEffect, useReducer, useRef } from 'react';
import { X } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { OrderExportsApiClient, type OrderExportDto } from '@/modules/order-exports';
import {
  buildOrderExportFilters,
  buildOrderExportFilterSummary,
  CLOSED_ORDER_EXPORT_DIALOG_STATE,
  createOrderExportSubmitController,
  generateOrderExportIdempotencyKey,
  isOrderExportSubmitDisabled,
  ORDER_EXPORT_FORMAT_OPTIONS,
  ORDER_EXPORT_GRANULARITY_OPTIONS,
  orderExportDialogReducer,
} from './order-export.helpers';
import type { OrdersListFilters, ProductionStepCatalog } from '../workspace/orders-list.helpers';

const T = TEST_IDS.orderExport;

const radioLabelCls = 'flex items-center gap-1.5 text-sm text-ink-2';

export interface OrderExportDialogProps {
  /** Filtres ACTIFS de la grille — jamais une copie amendee (point 3). */
  filters: OrdersListFilters;
  selectedCustomerLabel: string;
  stepCatalog: ProductionStepCatalog;
  onClose: () => void;
  /** Notifie l appelant (panneau) qu une demande a ete creee — jamais recalculee ici. */
  onCreated: (item: OrderExportDto) => void;
}

export function OrderExportDialog({ filters, selectedCustomerLabel, stepCatalog, onClose, onCreated }: OrderExportDialogProps) {
  const api = useWorkspaceApi(OrderExportsApiClient);
  const [state, dispatch] = useReducer(orderExportDialogReducer, CLOSED_ORDER_EXPORT_DIALOG_STATE);
  // Un SEUL controleur pour la duree de vie de la modale (le double-clic ne
  // doit pas creer un second controleur, dont le `inFlight` repartirait de
  // zero) — voir `order-export.helpers.ts`.
  const controllerRef = useRef<ReturnType<typeof createOrderExportSubmitController> | null>(null);
  if (controllerRef.current === null) controllerRef.current = createOrderExportSubmitController(api, dispatch);

  // Cle d idempotence generee A L OUVERTURE (point 4) — le montage EST
  // l ouverture (voir en-tete de fichier).
  useEffect(() => {
    dispatch({ type: 'opened', idempotencyKey: generateOrderExportIdempotencyKey() });
  }, []);

  const disabled = isOrderExportSubmitDisabled(state);
  const summary = buildOrderExportFilterSummary(filters, selectedCustomerLabel, stepCatalog);

  const handleSubmit = async () => {
    const created = await controllerRef.current!.submit(state, buildOrderExportFilters(filters));
    if (created) {
      onCreated(created);
      onClose();
    }
    // Sur echec, le controleur a deja dispatche `submitFailed` : `state.error`
    // porte le message, affiche ci-dessous. Rien de plus a faire ici.
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-paper rounded-2xl shadow-2xl w-full max-w-lg p-6"
        onClick={(event) => event.stopPropagation()}
        data-testid={T.dialog}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-ink">Exporter les commandes</h3>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 hover:bg-bg rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 text-sm text-ink-muted">
          {summary.length === 0 ? (
            <p>Tout l’historique de l’espace (aucun filtre actif).</p>
          ) : (
            <ul className="space-y-0.5">
              {summary.map((item) => (
                <li key={item.label}>
                  <span className="font-medium text-ink-2">{item.label} : </span>
                  {item.value}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 italic">
            Le fichier est trié par date de commande puis par numéro — le tri de la grille n’est pas repris.
          </p>
        </div>

        <fieldset className="mb-4" disabled={disabled}>
          <legend className="text-sm font-semibold text-ink-2 mb-1">Format</legend>
          <div className="flex gap-4">
            {ORDER_EXPORT_FORMAT_OPTIONS.map((option) => (
              <label key={option.value} className={radioLabelCls}>
                <input
                  type="radio"
                  name="order-export-format"
                  data-testid={T.formatRadio}
                  data-format={option.value}
                  checked={state.format === option.value}
                  onChange={() =>
                    dispatch({ type: 'formatChanged', format: option.value, freshIdempotencyKey: generateOrderExportIdempotencyKey() })
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-4" disabled={disabled}>
          <legend className="text-sm font-semibold text-ink-2 mb-1">Granularité</legend>
          <div className="flex gap-4">
            {ORDER_EXPORT_GRANULARITY_OPTIONS.map((option) => (
              <label key={option.value} className={radioLabelCls}>
                <input
                  type="radio"
                  name="order-export-granularity"
                  data-testid={T.granularityRadio}
                  data-granularity={option.value}
                  checked={state.granularity === option.value}
                  onChange={() =>
                    dispatch({
                      type: 'granularityChanged',
                      granularity: option.value,
                      freshIdempotencyKey: generateOrderExportIdempotencyKey(),
                    })
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {state.error && (
          <p data-testid={T.errorBanner} className="text-sm text-err-fg mb-3">
            {state.error}
          </p>
        )}

        <button
          type="button"
          data-testid={T.submitBtn}
          onClick={() => void handleSubmit()}
          disabled={disabled}
          className="w-full px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium"
        >
          {disabled ? 'Envoi…' : 'Exporter'}
        </button>
      </div>
    </div>
  );
}
