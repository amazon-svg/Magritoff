/**
 * CustomersPage — liste, recherche et creation de clients (CA1, TF-165).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Building2, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { TEST_IDS } from '@/shared/presentation/testIds';
import { CustomersApiClient } from '@/modules/customers/api/client';
import { useCustomersManagement } from '@/modules/customers/ui/hooks';
import { CustomerFormModal } from './CustomerFormModal';

const inputCls =
  'w-full px-3 py-2 border border-line-2 rounded-lg bg-paper text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand';
const btnPrimary =
  'px-4 py-2 bg-brand text-brand-ink rounded-lg hover:opacity-90 disabled:opacity-50 text-sm font-medium flex items-center gap-2';

export function DashboardCustomers() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tp = useTenantPath();
  const { items, loading, error, q, setQ, type, setType, create, refresh } = useCustomersManagement(
    Boolean(user && currentTenant),
  );
  const api = useWorkspaceApi(CustomersApiClient);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-5" data-testid={TEST_IDS.customer.page}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Clients</h1>
          <p className="text-sm text-ink-muted mt-1">
            {items.length} client{items.length > 1 ? 's' : ''} enregistré{items.length > 1 ? 's' : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className={btnPrimary}
          data-testid={TEST_IDS.customer.createBtn}
        >
          <Plus className="w-4 h-4" />
          Nouveau client
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Rechercher un client..."
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={type ?? ''}
          onChange={(event) => setType(event.target.value ? (event.target.value as 'company' | 'individual') : null)}
          className={inputCls}
          style={{ maxWidth: 200 }}
        >
          <option value="">Tous les types</option>
          <option value="company">Personne morale</option>
          <option value="individual">Personne physique</option>
        </select>
      </div>

      {error && <p className="text-sm text-err-fg">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted py-8 text-center">Aucun client pour l’instant.</p>
      ) : (
        <table className="w-full text-sm" data-testid={TEST_IDS.customer.table}>
          <thead>
            <tr className="text-left text-ink-muted border-b border-line">
              <th className="py-2 pr-3 font-medium">Type</th>
              <th className="py-2 pr-3 font-medium">Client</th>
              <th className="py-2 pr-3 font-medium">SIRET</th>
              <th className="py-2 pr-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {items.map((customer) => (
              <tr
                key={customer.id}
                data-testid={TEST_IDS.customer.row}
                data-customer-id={customer.id}
                className="border-b border-line/60 hover:bg-bg cursor-pointer"
              >
                <td className="py-2 pr-3">
                  {customer.type === 'company' ? (
                    <Building2 className="w-4 h-4 text-ink-muted" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-ink-muted" />
                  )}
                </td>
                <td className="py-2 pr-3">
                  <Link to={tp(`/dashboard/customers/${customer.id}`)} className="text-ink hover:text-brand hover:underline">
                    {customer.type === 'company'
                      ? customer.company_name
                      : `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-ink-muted">
                  {customer.siret ?? '—'}
                  {customer.siret && customer.siret_verified ? (
                    <span
                      className="ml-2 text-xs text-green-700"
                      data-testid={TEST_IDS.customer.siretVerifiedBadge}
                    >
                      vérifié
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-3">
                  {customer.is_active ? (
                    <span className="text-xs text-ink-2">Actif</span>
                  ) : (
                    <span className="text-xs text-ink-muted">Inactif</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        // Meme correctif que ProjectsPage.tsx (bug live 2026-09-02, lenteur
        // percue) : `create()` (useCustomersManagement) rafraichit deja la
        // liste apres un `POST /customers` reussi ; `onClose` ne doit pas
        // refaire un second `GET /customers` en plus.
        //
        // Correctif qa-review B1 (2026-09-03) : le chemin personne morale a
        // une etape supplementaire (verification SIRET) que le chemin
        // personne physique n a pas — cette verification mute la ligne cote
        // serveur mais ne serait, sans `onVerified`, jamais repercutee dans
        // la liste avant un rechargement manuel. `onClose` reste un pur
        // fermant (pas de refresh systematique, pour ne pas reintroduire le
        // double `GET` du chemin personne physique) ; `onVerified` declenche
        // le seul refresh necessaire, exactement quand la mutation reelle a
        // eu lieu.
        <CustomerFormModal
          onClose={() => setShowCreate(false)}
          onCreate={create}
          onVerifySiret={(customerId) => api.verifySiret(customerId)}
          onVerified={() => {
            void refresh();
          }}
        />
      )}
    </div>
  );
}
