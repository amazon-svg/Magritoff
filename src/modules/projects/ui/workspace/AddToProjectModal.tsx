/**
 * AddToProjectModal — remplace le CTA « Ajouter au panier » sur les surfaces
 * internes Magrit (atelier, résultats de chiffrage), decision RP 28/08/2026
 * (story E10.1, CA1, CA4).
 *
 * Propose de choisir un projet EXISTANT (CA4) ou d en creer un nouveau
 * (reprend les memes champs que `ProjectCreateModal`, CA3 : nom + client
 * requis, validation desactivee tant que le client n est pas selectionne).
 * Le chiffrage est ensuite ajoute comme `project_items` via
 * `POST /projects/{id}/items` — jamais de calcul de prix ni de creation de
 * devis ici (E10.3, hors perimetre de cette story).
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import { ProjectsApiClient } from '@/modules/projects/api/client';
import type { ProjectDto } from '@/modules/projects/api/contracts';
import { customerDisplayName } from './ProjectCreateModal';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const labelCls = 'block text-sm font-medium text-ink-2 mb-1';
const btnPrimary =
  'w-full px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2';
const btnGhost =
  'w-full px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink';

export interface AddToProjectItem {
  label: string;
  quotePayload: Record<string, unknown>;
  clariprintConfig?: Record<string, unknown> | null;
}

export interface AddToProjectModalProps {
  item: AddToProjectItem;
  onClose: () => void;
  /** Notifie le projet dans lequel le chiffrage vient d etre ajoute. */
  onAdded?: (project: ProjectDto) => void;
}

type Mode = 'existing' | 'create';

export function AddToProjectModal({ item, onClose, onAdded }: AddToProjectModalProps) {
  const projectsApi = useWorkspaceApi(ProjectsApiClient);
  const customersApi = useWorkspaceApi(CustomersApiClient);

  const [mode, setMode] = useState<Mode>('existing');
  const [projects, setProjects] = useState<readonly ProjectDto[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [customers, setCustomers] = useState<readonly CustomerDto[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<ProjectDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    projectsApi
      .list({ status: 'active', pageSize: 100 })
      .then((response) => {
        if (!cancelled) {
          setProjects(response.items);
          if (response.items.length === 0) setMode('create');
        }
      })
      .catch(() => {
        if (!cancelled) setMode('create');
      })
      .finally(() => {
        if (!cancelled) setLoadingProjects(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectsApi]);

  useEffect(() => {
    let cancelled = false;
    customersApi
      .list({ pageSize: 200 })
      .then((response) => {
        if (!cancelled) setCustomers(response.items);
      })
      .catch(() => {
        if (!cancelled) setCustomers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCustomers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customersApi]);

  const canSubmit =
    mode === 'existing' ? Boolean(selectedProjectId) : Boolean(newName.trim() && newCustomerId);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || saving) return;
    setError(null);
    setSaving(true);
    try {
      const project =
        mode === 'existing'
          ? projects.find((candidate) => candidate.id === selectedProjectId)!
          : await projectsApi.create({ name: newName.trim(), customer_id: newCustomerId });

      await projectsApi.addItem(project.id, {
        label: item.label,
        quote_payload: item.quotePayload,
        clariprint_config: item.clariprintConfig ?? null,
      });

      setAddedTo(project);
      onAdded?.(project);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ajout au projet impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-paper rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
        data-testid={TEST_IDS.project.addToProjectModal}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-ink">Ajouter au projet</h3>
          <button onClick={onClose} className="p-1 hover:bg-bg rounded" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {addedTo ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              « {item.label} » ajouté au projet « {addedTo.name} ».
            </p>
            <button type="button" onClick={onClose} className={btnPrimary}>
              Terminer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="radio"
                  name="add-to-project-mode"
                  checked={mode === 'existing'}
                  onChange={() => setMode('existing')}
                  disabled={projects.length === 0}
                  data-testid={TEST_IDS.project.addToProjectExistingOption}
                />
                Projet existant
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="radio"
                  name="add-to-project-mode"
                  checked={mode === 'create'}
                  onChange={() => setMode('create')}
                  data-testid={TEST_IDS.project.addToProjectCreateOption}
                />
                Nouveau projet
              </label>
            </div>

            {mode === 'existing' ? (
              <div>
                <label className={labelCls} htmlFor="add-to-project-select">
                  Projet
                </label>
                <select
                  id="add-to-project-select"
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  className={inputCls}
                  disabled={loadingProjects}
                >
                  <option value="">
                    {loadingProjects ? 'Chargement…' : 'Sélectionner un projet'}
                  </option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className={labelCls} htmlFor="add-to-project-name">
                    Nom du projet
                  </label>
                  <input
                    id="add-to-project-name"
                    type="text"
                    required
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    className={inputCls}
                    data-testid={TEST_IDS.project.nameInput}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="add-to-project-customer">
                    Client
                  </label>
                  <select
                    id="add-to-project-customer"
                    required
                    value={newCustomerId}
                    onChange={(event) => setNewCustomerId(event.target.value)}
                    className={inputCls}
                    disabled={loadingCustomers}
                    data-testid={TEST_IDS.project.customerSelect}
                  >
                    <option value="">
                      {loadingCustomers ? 'Chargement…' : 'Sélectionner un client'}
                    </option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customerDisplayName(customer)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {error && <p className="text-sm text-err-fg">{error}</p>}

            <button
              type="submit"
              disabled={!canSubmit || saving}
              className={btnPrimary}
              data-testid={TEST_IDS.project.addToProjectSubmitBtn}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Ajouter au projet
            </button>
            <button type="button" onClick={onClose} className={btnGhost}>
              Annuler
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
