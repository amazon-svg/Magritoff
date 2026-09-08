/**
 * ProductionStepsPage — ecran de parametrage du flux de production du tenant
 * (E10.13, CA1-CA7). Liste ordonnee par `position`, glisser-deposer pour
 * reordonner (`PUT /production-step-positions`, If-Match sur le CATALOGUE),
 * creation/renommage/couleur/terminale/activation via `POST`/`PATCH`
 * (If-Match sur l ETAPE), suppression (`DELETE`, 409 `production_step.in_use`
 * affiche en erreur — l issue normale est la desactivation, CA3).
 *
 * L ecran n est monte que sous une route `requiredCapabilities:
 * ['can_manage_production_steps']` (voir `../../surface-contributions.ts`) :
 * une garde d ergonomie, pas d autorisation — celle-ci est tenue par la RLS
 * de `production_steps` (migration 20260908020000).
 *
 * Aucun calcul metier ici : la position est toujours celle rendue par le
 * serveur apres `reorder()`/`create()`/`remove()` (jamais recalculee cote
 * navigateur), et aucune regle de transition n est evaluee (CA5 : le
 * franchissement d etape est le sujet d E10.14, hors de cet ecran).
 *
 * `catalog` (etat) porte TOUJOURS la liste COMPLETE du tenant (actives ET
 * desactivees) : une seule lecture non filtree (`api.list()`), jamais de
 * requete filtree par `status`. Le filtre choisi a l ecran (`statusFilter`)
 * ne fait QUE projeter ce catalogue pour l affichage (`filterStepsForDisplay`,
 * `./production-steps.helpers.ts`) — il n a aucune incidence sur le corps du
 * reorder (`computeReorderedStepIds`, meme fichier), qui reste construit sur
 * le catalogue complet (qa-review E10.13 round 1, B1 : CONVENTIONS.md §8.15
 * decision #5/#8, `step_ids` doit toujours porter la liste complete).
 */
import { useEffect, useMemo, useState } from 'react';
import { GripVertical, Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { ProductionStepsApiClient } from '@/modules/production-steps/api/client';
import type {
  ProductionStepColor,
  ProductionStepDto,
  ProductionStepStatusFilter,
} from '@/modules/production-steps/api/contracts';
import { PRODUCTION_STEP_COLORS } from '@/modules/production-steps/api/contracts';
import { computeReorderedStepIds, filterStepsForDisplay } from './production-steps.helpers';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink disabled:opacity-50';

const COLOR_SWATCH: Record<ProductionStepColor, string> = {
  slate: 'bg-slate-400',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  violet: 'bg-violet-500',
};

/** Ligne en cours d edition (label/couleur/terminale) — jamais synchronisee avec le serveur avant le clic sur `saveBtn`. */
type DraftState = Readonly<{ label: string; color: ProductionStepColor; isTerminal: boolean }>;

function toDraft(step: ProductionStepDto): DraftState {
  return { label: step.label, color: step.color, isTerminal: step.is_terminal };
}

export function DashboardProductionSteps() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const api = useWorkspaceApi(ProductionStepsApiClient);
  const enabled = Boolean(user && currentTenant);

  /** Catalogue COMPLET du tenant (actives ET desactivees) — jamais filtre. */
  const [catalog, setCatalog] = useState<readonly ProductionStepDto[]>([]);
  const [catalogEtag, setCatalogEtag] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProductionStepStatusFilter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Readonly<Record<string, DraftState>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  /** Projection d affichage SEULE — jamais utilisee pour construire un reorder. */
  const steps = useMemo(() => filterStepsForDisplay(catalog, statusFilter), [catalog, statusFilter]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      // Toujours le catalogue COMPLET : le filtre de statut est un affichage
      // pur, applique cote client par `steps` (voir useMemo ci-dessus) — pas
      // une requete serveur distincte (qa-review E10.13 round 1, B1).
      const { data, etag } = await api.list();
      setCatalog(data);
      setCatalogEtag(etag ?? null);
      setDrafts(Object.fromEntries(data.map((step) => [step.id, toDraft(step)])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lecture des etapes de production impossible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const setDraft = (stepId: string, patch: Partial<DraftState>) => {
    setDrafts((current) => ({ ...current, [stepId]: { ...current[stepId]!, ...patch } }));
  };

  const handleSave = async (step: ProductionStepDto) => {
    const draft = drafts[step.id];
    if (!draft) return;
    setSavingId(step.id);
    setError(null);
    try {
      const { etag } = await api.getForEdit(step.id);
      if (!etag) throw new Error('ETag de l etape indisponible.');
      await api.update(
        step.id,
        { label: draft.label, color: draft.color, is_terminal: draft.isTerminal },
        etag,
      );
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement de l etape impossible.');
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (step: ProductionStepDto) => {
    setSavingId(step.id);
    setError(null);
    try {
      const { etag } = await api.getForEdit(step.id);
      if (!etag) throw new Error('ETag de l etape indisponible.');
      await api.setActive(step.id, !step.is_active, etag);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Changement d etat de l etape impossible.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (step: ProductionStepDto) => {
    setSavingId(step.id);
    setError(null);
    try {
      await api.remove(step.id);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `${cause.message} — utilisez la desactivation si l etape est encore portee par une commande.`
          : 'Suppression de l etape impossible.',
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    setCreating(true);
    setError(null);
    try {
      await api.create({ label, is_terminal: false });
      setNewLabel('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Creation de l etape impossible.');
    } finally {
      setCreating(false);
    }
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId || !catalogEtag) {
      setDraggedId(null);
      return;
    }
    // `draggedId`/`targetId` proviennent de la liste AFFICHEE (potentiellement
    // filtree), mais `computeReorderedStepIds` retrouve leur position dans le
    // catalogue COMPLET (`catalog`, jamais `steps`) : le corps du reorder
    // porte donc toujours la totalite des etapes du tenant.
    const reorderedIds = computeReorderedStepIds(catalog, draggedId, targetId);
    setDraggedId(null);
    if (!reorderedIds) return;

    setReordering(true);
    setError(null);
    try {
      const { data, etag } = await api.reorder({ step_ids: [...reorderedIds] }, catalogEtag);
      // La reponse est elle aussi le catalogue COMPLET dans le nouvel ordre :
      // `steps` (projection filtree, useMemo) reapplique automatiquement le
      // filtre courant — jamais d ecran qui reaffiche des etapes desactivees
      // hors filtre, meme un instant.
      setCatalog(data);
      setCatalogEtag(etag ?? null);
      setDrafts(Object.fromEntries(data.map((step) => [step.id, toDraft(step)])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reordonnancement impossible.');
      await refresh();
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="space-y-5" data-testid={TEST_IDS.productionStep.page}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Étapes de production</h1>
          <p className="text-sm text-ink-muted mt-1">
            Flux d’atelier du tenant — glissez-déposez pour réordonner, désactivez plutôt que supprimer une
            étape encore utilisée par une commande.
          </p>
        </div>
        <select
          value={statusFilter ?? ''}
          onChange={(event) =>
            setStatusFilter(event.target.value ? (event.target.value as ProductionStepStatusFilter) : null)
          }
          className={inputCls}
          style={{ maxWidth: 200 }}
        >
          <option value="">Toutes les étapes</option>
          <option value="active">Actives</option>
          <option value="disabled">Désactivées</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-err-fg" data-testid={TEST_IDS.productionStep.errorBanner}>
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="flex items-center gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder="Nouvelle étape (ex. Contrôle qualité)"
          maxLength={60}
          className={`${inputCls} max-w-sm`}
          data-testid={TEST_IDS.productionStep.addLabelInput}
        />
        <button
          type="submit"
          disabled={creating || !newLabel.trim()}
          className={btnPrimary}
          data-testid={TEST_IDS.productionStep.addBtn}
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Ajouter
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : steps.length === 0 ? (
        <p className="text-sm text-ink-muted py-8 text-center">Aucune étape pour l’instant.</p>
      ) : (
        <div className="space-y-2">
          {steps.map((step) => {
            const draft = drafts[step.id] ?? toDraft(step);
            const busy = savingId === step.id || reordering;
            return (
              <div
                key={step.id}
                draggable
                onDragStart={() => setDraggedId(step.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void handleDrop(step.id)}
                data-testid={TEST_IDS.productionStep.row}
                data-step-id={step.id}
                data-status={step.is_active ? 'active' : 'disabled'}
                className={`flex items-center gap-3 border border-line-2 rounded-lg p-3 bg-paper ${
                  step.is_active ? '' : 'opacity-60'
                }`}
              >
                <span
                  className="cursor-grab text-ink-muted"
                  data-testid={TEST_IDS.productionStep.dragHandle}
                  aria-label="Réordonner"
                >
                  <GripVertical className="w-4 h-4" />
                </span>

                <span className={`inline-block w-2.5 h-2.5 rounded-full ${COLOR_SWATCH[draft.color]}`} />

                <input
                  type="text"
                  value={draft.label}
                  onChange={(event) => setDraft(step.id, { label: event.target.value })}
                  maxLength={60}
                  disabled={busy}
                  className={`${inputCls} max-w-xs`}
                  data-testid={TEST_IDS.productionStep.labelInput}
                />

                <select
                  value={draft.color}
                  onChange={(event) => setDraft(step.id, { color: event.target.value as ProductionStepColor })}
                  disabled={busy}
                  className={inputCls}
                  style={{ maxWidth: 140 }}
                  data-testid={TEST_IDS.productionStep.colorSelect}
                >
                  {PRODUCTION_STEP_COLORS.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-1.5 text-xs text-ink-2 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={draft.isTerminal}
                    onChange={(event) => setDraft(step.id, { isTerminal: event.target.checked })}
                    disabled={busy}
                    data-testid={TEST_IDS.productionStep.terminalCheckbox}
                  />
                  Terminale
                </label>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSave(step)}
                    disabled={busy}
                    className={btnPrimary}
                    data-testid={TEST_IDS.productionStep.saveBtn}
                  >
                    {savingId === step.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(step)}
                    disabled={busy}
                    className={btnGhost}
                    data-testid={TEST_IDS.productionStep.deactivateBtn}
                  >
                    {step.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(step)}
                    disabled={busy}
                    className="p-2 text-ink-muted hover:text-err-fg disabled:opacity-50"
                    aria-label="Supprimer"
                    data-testid={TEST_IDS.productionStep.deleteBtn}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
