import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useShops } from '@/modules/shops/ui/runtime';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { type OrderListFilters } from '@/modules/orders';
import { OrderHistoryTable } from '../storefront/OrderHistoryTable';
import { STATUS_LABELS } from '../helpers/orderStatus';
import { OrderExportPanel } from '@/modules/commercial-orders/ui';
import { useUnifiedOrders } from '../hooks/useUnifiedOrders';

const inputClass = 'rounded border border-line bg-paper px-2.5 py-2 text-sm text-ink';
const filterControlClass = `${inputClass} h-9 w-full min-w-0`;
const filterLabelClass = 'flex min-w-0 flex-col gap-1.5 text-xs font-medium text-ink-muted';

export function DashboardOrders() {
  const navigate = useNavigate();
  const tenantPath = useTenantPath();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { shops } = useShops();
  const tenantId = currentTenant?.id ?? null;
  const management = useUnifiedOrders(tenantId, Boolean(user));
  const { auditApi, steps, stepsError } = management;
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterError, setFilterError] = useState<string | null>(null);

  useEffect(() => {
    setFilters({}); setFilterError(null);
  }, [tenantId]);

  const change = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (filters.created_from && filters.created_to && filters.created_from > filters.created_to) {
      setFilterError('La fin doit suivre le début de la période.'); return;
    }
    setFilterError(null);
    management.applyFilters(Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value)) as OrderListFilters);
  };

  return (
    <div className="w-full min-w-0" style={{ fontFamily: 'var(--font-ui)' }} data-testid="dashboard-orders-page">
      <div className="mb-6">
        <h1 className="text-ink m-0" style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em', lineHeight: 1.05 }}>Commandes</h1>
        <p className="mt-2 mb-0 text-ink-muted text-sm">Toutes origines confondues, de la plus récente à la plus ancienne.</p>
      </div>
      <form onSubmit={apply} className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-line bg-bg p-4" aria-label="Filtres des commandes">
        <label className={`${filterLabelClass} flex-[1_1_160px]`}> Client
          <input className={filterControlClass} value={filters.customer_search ?? ''} maxLength={200} placeholder="Nom ou courriel" onChange={(event) => change('customer_search', event.target.value)} />
        </label>
        <label className={`${filterLabelClass} flex-[1_1_100px]`}> Origine
          <select className={filterControlClass} value={filters.origin ?? ''} onChange={(event) => change('origin', event.target.value)}>
            <option value="">Toutes</option><option value="storefront">Boutique</option><option value="quote">Devis</option>
          </select>
        </label>
        <label className={`${filterLabelClass} flex-[1_1_150px]`}> Statut
          <select className={filterControlClass} value={filters.status ?? ''} onChange={(event) => change('status', event.target.value)}>
            <option value="">Tous</option>
            {Object.entries(STATUS_LABELS).filter(([, info]) => info.group !== 'legacy').map(([key, label]) => <option key={key} value={key}>{label.label}</option>)}
          </select>
        </label>
        <label className={`${filterLabelClass} flex-[1_1_180px]`}> Boutique
          <select className={filterControlClass} value={filters.shop_id ?? ''} onChange={(event) => change('shop_id', event.target.value)}>
            <option value="">Toutes</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name || shop.slug}</option>)}
          </select>
        </label>
        <label className={`${filterLabelClass} flex-[1_1_170px]`}> Étape de production
          <select className={filterControlClass} disabled={stepsError} value={filters.current_production_step_id ?? ''} onChange={(event) => change('current_production_step_id', event.target.value)}>
            <option value="">Toutes</option>{steps.map((step) => <option key={step.id} value={step.id}>{step.label}</option>)}
          </select>
        </label>
        <label className={`${filterLabelClass} flex-[1_1_145px]`}> Du
          <input className={filterControlClass} type="date" value={filters.created_from ?? ''} onChange={(event) => change('created_from', event.target.value)} />
        </label>
        <label className={`${filterLabelClass} flex-[1_1_145px]`}> Au
          <input className={filterControlClass} type="date" value={filters.created_to ?? ''} onChange={(event) => change('created_to', event.target.value)} />
        </label>
        <div className="flex shrink-0 items-center gap-2">
          <button className={`${inputClass} h-9 whitespace-nowrap disabled:opacity-50`} type="submit" disabled={management.loading}>Appliquer</button>
          <button className={`${inputClass} h-9 whitespace-nowrap`} type="button" onClick={() => { setFilters({}); setFilterError(null); management.applyFilters({}); }}>Réinitialiser</button>
        </div>
      </form>
      {stepsError && <p className="text-sm text-err-fg" role="status">Les étapes de production sont indisponibles. Les autres filtres restent utilisables.</p>}
      {filterError && <p className="text-sm text-err-fg" role="alert">{filterError}</p>}
      <OrderExportPanel key={tenantId} unifiedSelection={{ filters: management.activeFilters, summary: [
        ...(management.activeFilters.origin ? [{ label: 'Origine', value: management.activeFilters.origin === 'quote' ? 'Devis' : 'Boutique' }] : []),
        ...(management.activeFilters.status ? [{ label: 'Statut', value: STATUS_LABELS[management.activeFilters.status].label }] : []),
        ...(management.activeFilters.customer_search ? [{ label: 'Client', value: management.activeFilters.customer_search }] : []),
        ...(management.activeFilters.customer_id ? [{ label: 'Client', value: management.activeFilters.customer_id }] : []),
        ...(management.activeFilters.shop_id ? [{ label: 'Boutique', value: shops.find((shop) => shop.id === management.activeFilters.shop_id)?.name ?? management.activeFilters.shop_id }] : []),
        ...(management.activeFilters.current_production_step_id ? [{ label: 'Étape', value: steps.find((step) => step.id === management.activeFilters.current_production_step_id)?.label ?? management.activeFilters.current_production_step_id }] : []),
        ...(management.activeFilters.created_from || management.activeFilters.created_to ? [{ label: 'Période', value: `${management.activeFilters.created_from ?? '…'} → ${management.activeFilters.created_to ?? '…'}` }] : []),
      ] }} />
      <OrderHistoryTable
        orders={management.orders} loading={management.loading} error={management.error}
        auditApi={auditApi} appearance="dashboard" serverManaged
        onOpenOrder={(order) => navigate(tenantPath(`/dashboard/orders/${order.id}`))}
        onOpenCustomer={(order) => { if (order.customer_id) navigate(tenantPath(`/dashboard/customers/${order.customer_id}`)); }}
        extraColumn={{ header: 'Origine', position: 'after-date', render: (order) => (
          <span className="text-xs">{order.source === 'commercial' ? 'Devis' : management.orders.find((item) => item.id === order.id)?.shop_name ?? 'Boutique'}</span>
        ) }}
      />
      {management.error && <button className={`${inputClass} mt-3`} type="button" onClick={management.reload}>Réessayer</button>}
      <nav className="mt-4 flex items-center gap-4 text-sm" aria-label="Pagination des commandes">
        <button className={inputClass} type="button" disabled={management.loading || management.page === 1} onClick={management.previous}>Précédente</button>
        <span aria-live="polite">Page {management.page} · {management.orders.length} commande{management.orders.length > 1 ? 's' : ''}</span>
        <button className={inputClass} type="button" disabled={management.loading || !management.hasNext} onClick={management.next}>Suivante</button>
      </nav>
    </div>
  );
}
