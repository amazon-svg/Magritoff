/**
 * ProjectCreateModal — creation d un projet (story E10.1, CA3).
 *
 * Le nom et le client sont tous deux requis ; le bouton de validation reste
 * desactive tant que le client n est pas selectionne (CA3), meme si l API
 * reste la seule autorite reelle (contrainte NOT NULL + `project.customer_required`).
 */
import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CustomersApiClient, type CustomerDto } from '@/modules/customers';
import type { CreateProjectCommand, ProjectDto } from '@/modules/projects/api/contracts';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const labelCls = 'block text-sm font-medium text-ink-2 mb-1';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2';
const btnGhost =
  'px-3 py-1.5 border border-line-2 rounded-lg text-sm text-ink-2 hover:bg-bg hover:text-ink';

export function customerDisplayName(customer: CustomerDto): string {
  return customer.type === 'company'
    ? (customer.company_name ?? 'Client')
    : `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || 'Client';
}

export interface ProjectCreateModalProps {
  onClose: () => void;
  onCreate: (command: CreateProjectCommand) => Promise<ProjectDto>;
  onCreated?: (project: ProjectDto) => void;
  /** Client pre-selectionne (ex. depuis la fiche client, ou un chiffrage deja associe). */
  initialCustomerId?: string;
}

export function ProjectCreateModal({
  onClose,
  onCreate,
  onCreated,
  initialCustomerId,
}: ProjectCreateModalProps) {
  const customersApi = useWorkspaceApi(CustomersApiClient);
  const [customers, setCustomers] = useState<readonly CustomerDto[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState(initialCustomerId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCustomers(true);
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerId) return;
    setError(null);
    setSaving(true);
    try {
      const created = await onCreate({ name: name.trim(), customer_id: customerId });
      onCreated?.(created);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création du projet impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-paper rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(event) => event.stopPropagation()}
        data-testid={TEST_IDS.project.createModal}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-ink">Nouveau projet</h3>
          <button onClick={onClose} className="p-1 hover:bg-bg rounded" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="project-name">
              Nom du projet
            </label>
            <input
              id="project-name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputCls}
              data-testid={TEST_IDS.project.nameInput}
              placeholder="Ex. Salon Imprim'Expo 2026"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="project-customer">
              Client
            </label>
            <select
              id="project-customer"
              required
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
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
            {!loadingCustomers && customers.length === 0 && (
              <p className="text-xs text-ink-muted mt-1">
                Aucun client enregistré. Créez d’abord un client depuis « Clients ».
              </p>
            )}
          </div>

          {error && <p className="text-sm text-err-fg">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 ${btnGhost}`}>
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !customerId || !name.trim()}
              className={`flex-1 ${btnPrimary}`}
              data-testid={TEST_IDS.project.createSubmitBtn}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
