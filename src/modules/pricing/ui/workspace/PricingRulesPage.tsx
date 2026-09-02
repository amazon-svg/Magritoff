/**
 * PricingRulesPage — liste, filtre et bascule des regles de prix (E10.6,
 * CA5, CA6). L ecran n est monte que sous une route `requiredTenantRole:
 * 'admin'` (voir `../../surface-contributions.ts`) : E10.11 (droits
 * Admin/Commercial dedies) n est pas encore livree, ce garde grossier sera
 * raffine par cette story future.
 *
 * Creation/modification passent par `PriceRuleFormModal` ; aucun calcul de
 * prix ni de marge n a lieu ici (E10.21 hors perimetre).
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { PriceRulesApiClient } from '@/modules/pricing/api/client';
import type { PriceRuleDto, PriceRuleStatusFilter } from '@/modules/pricing/api/contracts';
import { usePriceRulesManagement } from '@/modules/pricing/ui/hooks';
import { PriceRuleFormModal } from './PriceRuleFormModal';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2';

const SCOPE_LABELS: Record<PriceRuleDto['scope'], string> = {
  global: 'Globale',
  range: 'Gamme',
  customer: 'Client',
  customer_range: 'Client + gamme',
};

function formatPercent(rate: string): string {
  const value = Number(rate) * 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2)} %`;
}

function formatPeriod(rule: PriceRuleDto): string {
  return rule.ends_on ? `${rule.starts_on} → ${rule.ends_on}` : `${rule.starts_on} → sans terme`;
}

type EditingState = Readonly<{ rule: PriceRuleDto; etag: string }>;

export function DashboardPricingRules() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const api = useWorkspaceApi(PriceRulesApiClient);
  const { items, loading, error, q, setQ, status, setStatus, create, toggleActive, refresh } =
    usePriceRulesManagement(Boolean(user && currentTenant));
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openEdit = async (rule: PriceRuleDto) => {
    const { data, etag } = await api.getForEdit(rule.id);
    if (!etag) throw new Error('ETag de la règle indisponible.');
    setEditing({ rule: data, etag });
  };

  const handleToggle = async (rule: PriceRuleDto) => {
    setTogglingId(rule.id);
    try {
      await toggleActive(rule);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-5" data-testid={TEST_IDS.pricing.page}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Règles de prix</h1>
          <p className="text-sm text-ink-muted mt-1">
            {items.length} règle{items.length > 1 ? 's' : ''} de marge ou de remise.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={btnPrimary}
          data-testid={TEST_IDS.pricing.createBtn}
        >
          <Plus className="w-4 h-4" />
          Nouvelle règle
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Rechercher par nom..."
          className={`${inputCls} max-w-sm`}
        />
        <select
          value={status ?? ''}
          onChange={(event) =>
            setStatus(event.target.value ? (event.target.value as PriceRuleStatusFilter) : null)
          }
          className={inputCls}
          style={{ maxWidth: 200 }}
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actives</option>
          <option value="disabled">Désactivées</option>
        </select>
      </div>

      {error && <p className="text-sm text-err-fg">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted py-8 text-center">Aucune règle de prix pour l’instant.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted border-b border-line">
              <th className="py-2 pr-3 font-medium">Nom</th>
              <th className="py-2 pr-3 font-medium">Portée</th>
              <th className="py-2 pr-3 font-medium">Valeur</th>
              <th className="py-2 pr-3 font-medium">Période</th>
              <th className="py-2 pr-3 font-medium">Statut</th>
              <th className="py-2 pr-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((rule) => (
              <tr
                key={rule.id}
                data-testid={TEST_IDS.pricing.row}
                data-rule-id={rule.id}
                data-status={rule.is_active ? 'active' : 'disabled'}
                className="border-b border-line/60 hover:bg-bg"
              >
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    onClick={() => void openEdit(rule)}
                    className="text-ink hover:text-brand hover:underline text-left"
                  >
                    {rule.name}
                  </button>
                </td>
                <td className="py-2 pr-3 text-ink-muted">{SCOPE_LABELS[rule.scope]}</td>
                <td className="py-2 pr-3 text-ink-muted">
                  {rule.value_type === 'margin_rate' ? 'Marge' : 'Remise'} {formatPercent(rule.value)}
                </td>
                <td className="py-2 pr-3 text-ink-muted">{formatPeriod(rule)}</td>
                <td className="py-2 pr-3">
                  <span
                    data-testid={TEST_IDS.pricing.statusPill}
                    className={`inline-flex items-center gap-1.5 text-xs ${
                      rule.is_active ? 'text-green-700' : 'text-ink-muted'
                    }`}
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        rule.is_active ? 'bg-green-600' : 'bg-ink-muted'
                      }`}
                    />
                    {rule.is_active ? 'Active' : 'Désactivée'}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">
                  <button
                    type="button"
                    onClick={() => void handleToggle(rule)}
                    disabled={togglingId === rule.id}
                    className="text-xs text-ink-2 border border-line-2 rounded-lg px-2 py-1 hover:bg-bg disabled:opacity-50"
                    data-testid={TEST_IDS.pricing.toggleActiveBtn}
                  >
                    {rule.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <PriceRuleFormModal
          onClose={() => setShowCreate(false)}
          onCreate={create}
          onUpdate={(id, command, ifMatch) => api.update(id, command, ifMatch).then((r) => r.data)}
          onSaved={() => void refresh()}
        />
      )}

      {editing && (
        <PriceRuleFormModal
          editing={editing}
          onClose={() => setEditing(null)}
          onCreate={create}
          onUpdate={(id, command, ifMatch) => api.update(id, command, ifMatch).then((r) => r.data)}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}
