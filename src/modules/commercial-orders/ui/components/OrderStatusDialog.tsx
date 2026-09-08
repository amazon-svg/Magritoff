/**
 * OrderStatusDialog — modale UNIQUE de changement de statut et historique
 * horodate d une commande (E10.14, amendement du 01/09/2026, Xavier
 * Péchoultres).
 *
 * UN SEUL COMPOSANT, DEUX POINTS D APPEL (CA1/CA2) : le bouton « Statut » de
 * la ligne de grille et celui de la fiche commande doivent tous deux ouvrir
 * CETTE modale — jamais une seconde implementation. `OrderStatusButton`
 * (fichier voisin) est le point d appel reutilisable ; ce fichier ne fait
 * QUE le contenu de la modale, pour rester montable depuis n importe quel
 * declencheur futur (grille E10.16, fiche commande) sans dependre de l un ou
 * l autre.
 *
 * UN SEUL ECRAN A DEUX COLONNES (contrat E10.14, pas une modale + un panneau
 * separe) :
 *  - GAUCHE : historique horodate (`listOrderStepChanges`), du plus recent
 *    au plus ancien, avec auteur — c est le SEUL endroit ou l historique de
 *    production est lisible (CA6) : aucun panneau separe sur la fiche.
 *  - DROITE : etapes du tenant dans l ordre configure
 *    (`listProductionSteps`), etape courante mise en evidence, etapes deja
 *    FRANCHIES (au sens de la position, un affichage seul — CA4 : le saut
 *    est autorise, aucune etape intermediaire n est jamais VALIDEE)
 *    distinguees visuellement, chacune cliquable.
 *
 * CA4 : le saut direct vers une etape avancee reste possible, ne valide
 * aucune etape intermediaire — ce composant ne bloque JAMAIS une selection
 * au pretexte qu elle « saute » des etapes, et ne calcule ni ne persiste
 * aucune progression cote client (`.claude/rules/frontend.md` : aucun
 * controle metier pose uniquement cote navigateur — la seule verite est
 * l API, `changeOrderProductionStep`).
 *
 * AUCUN `If-Match` : le contrat (decision #6, docs/api/CONVENTIONS.md §8.16)
 * assume le dernier ecrivain gagnant sur ce geste — `CommercialOrdersApiClient.
 * changeProductionStep()` n en lit ni n en pose.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CommercialOrdersApiClient } from '@/modules/commercial-orders/api/client';
import type { OrderStepChangeDto } from '@/modules/commercial-orders/api/contracts';
// Import PAR LA FACADE PUBLIQUE du module (`@/modules/production-steps`),
// jamais un chemin profond `api/client`/`api/contracts` — regle des
// frontieres UX modulaires (MUX, tests/architecture/modular-ui-boundaries.
// test.ts) : un composant d un module ne lit un autre module que par son
// entree publique.
import { ProductionStepsApiClient, type ProductionStepDto } from '@/modules/production-steps';
import { currentStepPosition, stepVisualState } from './order-status.helpers';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnPrimary =
  'w-full px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2';

export interface OrderStatusDialogProps {
  orderId: string;
  onClose: () => void;
  /** Notifie l appelant (grille, fiche) qu une transition a reussi — pour qu il rafraichisse son propre etat sans le recalculer ici. */
  onChanged?: (entry: OrderStepChangeDto) => void;
}

export function OrderStatusDialog({ orderId, onClose, onChanged }: OrderStatusDialogProps) {
  const ordersApi = useWorkspaceApi(CommercialOrdersApiClient);
  const stepsApi = useWorkspaceApi(ProductionStepsApiClient);

  const [steps, setSteps] = useState<readonly ProductionStepDto[]>([]);
  const [history, setHistory] = useState<readonly OrderStepChangeDto[]>([]);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Trois lectures independantes : le catalogue COMPLET des etapes
      // (`listProductionSteps`, actives ET desactivees — une etape
      // desactivee reste lisible dans l historique, decision #8/#11 du
      // contrat), l etape COURANTE de la commande (`getDetail`) et le
      // journal ANTICHRONOLOGIQUE (`listOrderStepChanges`).
      const [order, stepsResponse, historyResponse] = await Promise.all([
        ordersApi.getDetail(orderId),
        stepsApi.list(),
        ordersApi.listStepChanges(orderId, { pageSize: 50 }),
      ]);
      setCurrentStepId(order.current_production_step_id);
      setSteps([...stepsResponse.data].sort((a, b) => a.position - b.position));
      setHistory(historyResponse.items);
      setSelectedStepId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lecture du statut de la commande impossible.');
    } finally {
      setLoading(false);
    }
  }, [ordersApi, stepsApi, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentPosition = useMemo(
    () => currentStepPosition(steps, currentStepId),
    [steps, currentStepId],
  );

  const handleConfirm = async () => {
    if (!selectedStepId || selectedStepId === currentStepId) return;
    setConfirming(true);
    setError(null);
    try {
      const entry = await ordersApi.changeProductionStep(orderId, {
        step_id: selectedStepId,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setNote('');
      onChanged?.(entry);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Changement de statut impossible.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-paper rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        data-testid={TEST_IDS.orderStatus.dialog}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-ink">Statut de la commande</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-bg rounded"
            aria-label="Fermer"
            data-testid={TEST_IDS.orderStatus.closeBtn}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <p className="text-sm text-err-fg mb-3" data-testid={TEST_IDS.orderStatus.errorBanner}>
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-ink-muted">Chargement…</p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* Colonne GAUCHE — historique horodate (CA6). Seul endroit ou il se lit. */}
            <div
              data-testid={TEST_IDS.orderStatus.historyPanel}
              className="space-y-2 max-h-[60vh] overflow-y-auto pr-3 border-r border-line-2"
            >
              <h4 className="text-sm font-semibold text-ink-2 uppercase tracking-wide">Historique</h4>
              {history.length === 0 ? (
                <p className="text-sm text-ink-muted py-4">Aucun mouvement pour l’instant.</p>
              ) : (
                history.map((entry) => {
                  const toLabel = steps.find((step) => step.id === entry.to_step_id)?.label ?? entry.to_step_id;
                  const fromLabel = entry.from_step_id
                    ? (steps.find((step) => step.id === entry.from_step_id)?.label ?? entry.from_step_id)
                    : null;
                  return (
                    <div
                      key={entry.id}
                      data-testid={TEST_IDS.orderStatus.historyRow}
                      data-history-id={entry.id}
                      className="border border-line-2 rounded-lg p-2.5 text-sm"
                    >
                      <div className="font-medium text-ink">{fromLabel ? `${fromLabel} → ${toLabel}` : toLabel}</div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {new Date(entry.occurred_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' · '}
                        {entry.actor_label ?? 'Auteur inconnu'}
                      </div>
                      {entry.note && <div className="text-xs text-ink-2 mt-1 italic">« {entry.note} »</div>}
                    </div>
                  );
                })
              )}
            </div>

            {/* Colonne DROITE — etapes du tenant, ordre configure (CA1/CA4). */}
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-ink-2 uppercase tracking-wide">Étapes</h4>
              <div className="space-y-1.5">
                {steps.map((step) => {
                  const state = stepVisualState(step, currentStepId, currentPosition);
                  const selected = selectedStepId === step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setSelectedStepId(step.id)}
                      data-testid={TEST_IDS.orderStatus.option}
                      data-step-id={step.id}
                      data-state={state}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm flex items-center justify-between transition-colors ${
                        selected
                          ? 'border-brand bg-brand/10'
                          : state === 'current'
                            ? 'border-brand/60 bg-brand/5 font-medium'
                            : 'border-line-2 hover:bg-bg'
                      } ${state === 'done' ? 'text-ink-2' : 'text-ink'} ${!step.is_active ? 'opacity-60' : ''}`}
                    >
                      <span>{step.label}</span>
                      {state === 'current' && <span className="text-xs text-brand shrink-0">Étape actuelle</span>}
                      {state === 'done' && <span className="text-xs text-ink-muted shrink-0">Franchie</span>}
                      {!step.is_active && <span className="text-xs text-ink-muted shrink-0">Désactivée</span>}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Note (facultative) — ex. fichier repassé en PAO, fond perdu manquant"
                className={`${inputCls} mt-3`}
              />

              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!selectedStepId || selectedStepId === currentStepId || confirming}
                className={`${btnPrimary} mt-2`}
                data-testid={TEST_IDS.orderStatus.confirmBtn}
              >
                {confirming && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer le changement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
