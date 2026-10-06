import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useShops } from '@/modules/shops/ui/runtime';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { type OrderListFilters } from '@/modules/orders';
import { OrderHistoryTable } from '../storefront/OrderHistoryTable';
import { STATUS_LABELS } from '../helpers/orderStatus';
import { OrderExportPanel, OrderStatusButton } from '@/modules/commercial-orders/ui';
import { useUnifiedOrders } from '../hooks/useUnifiedOrders';
import { productionStepReadOnlyReason, resolveVisibleOrderStatus } from './order-status-presentation';

const inputClass = 'rounded border border-line bg-paper px-2.5 py-2 text-sm text-ink';
const filterControlClass = `${inputClass} h-9 w-full min-w-0`;
const filterLabelClass = 'flex min-w-0 flex-col gap-1.5 text-xs font-medium text-ink-muted';

type BulkResult = Readonly<{
  succeeded: number;
  failures: readonly Readonly<{ orderId: string; label: string; message: string }>[];
}>;

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
  const [selectedOrderIds, setSelectedOrderIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  useEffect(() => {
    setFilters({}); setFilterError(null); setSelectedOrderIds(new Set()); setBulkAction(''); setBulkResult(null);
  }, [tenantId]);

  useEffect(() => {
    const visibleIds = new Set(management.orders.map((order) => order.id));
    setSelectedOrderIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [management.orders]);

  useEffect(() => {
    if (selectedOrderIds.size === 0) setBulkAction('');
  }, [selectedOrderIds.size]);

  const change = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (filters.created_from && filters.created_to && filters.created_from > filters.created_to) {
      setFilterError('La fin doit suivre le début de la période.'); return;
    }
    setFilterError(null);
    management.applyFilters(Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value)) as OrderListFilters);
  };
  const visibleStatusFilter = filters.current_production_step_id
    ? `step:${filters.current_production_step_id}`
    : filters.status
      ? `admin:${filters.status}`
      : '';
  const changeVisibleStatusFilter = (value: string) => {
    setFilters((current) => {
      const next = { ...current };
      delete next.status;
      delete next.current_production_step_id;
      if (value.startsWith('step:')) next.current_production_step_id = value.slice(5);
      if (value.startsWith('admin:')) next.status = value.slice(6);
      return next;
    });
  };
  const applyBulkStatus = async () => {
    if (!bulkAction || selectedOrderIds.size === 0 || bulkBusy) return;
    const selectedOrders = management.orders.filter((order) => selectedOrderIds.has(order.id));
    const validation = bulkAction === 'validate';
    const step = bulkAction.startsWith('step:')
      ? steps.find((candidate) => candidate.id === bulkAction.slice(5))
      : undefined;
    if (!validation && !step) return;

    const unverifiedCount = validation
      ? selectedOrders.filter((order) => order.hasUnverifiedPrices).length
      : 0;
    const countLabel = `${selectedOrders.length} commande${selectedOrders.length > 1 ? 's' : ''}`;
    const confirmation = validation
      ? `Valider ${countLabel} ?${unverifiedCount > 0 ? `\n\n${unverifiedCount} commande${unverifiedCount > 1 ? 's contiennent' : ' contient'} un prix non vérifié. Cette action confirme également ${unverifiedCount > 1 ? 'ces prix' : 'ce prix'}.` : ''}`
      : `Passer ${countLabel} au statut « ${step!.label} » ?`;
    if (!window.confirm(confirmation)) return;

    setBulkBusy(true);
    setBulkResult(null);
    const settled = await Promise.allSettled(selectedOrders.map((order) => (
      validation
        ? management.validateOrder(order)
        : management.changeProductionStep(order.id, step!.id)
    )));
    const failures = settled.flatMap((result, index) => result.status === 'rejected' ? [{
      orderId: selectedOrders[index]!.id,
      label: selectedOrders[index]!.number ?? `#${selectedOrders[index]!.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      message: result.reason instanceof Error ? result.reason.message : 'Changement de statut impossible.',
    }] : []);
    const failedIds = new Set(failures.map((failure) => failure.orderId));
    setSelectedOrderIds(failedIds);
    setBulkResult({ succeeded: settled.length - failures.length, failures });
    setBulkBusy(false);
    await management.reload();
  };
  const exportSelection = { filters: management.activeFilters, summary: [
    ...(management.activeFilters.origin ? [{ label: 'Origine', value: management.activeFilters.origin === 'quote' ? 'Devis' : 'Boutique' }] : []),
    ...(management.activeFilters.status ? [{ label: 'Statut', value: STATUS_LABELS[management.activeFilters.status]?.label ?? management.activeFilters.status }] : []),
    ...(management.activeFilters.customer_search ? [{ label: 'Client', value: management.activeFilters.customer_search }] : []),
    ...(management.activeFilters.customer_id ? [{ label: 'Client', value: management.activeFilters.customer_id }] : []),
    ...(management.activeFilters.shop_id ? [{ label: 'Boutique', value: shops.find((shop) => shop.id === management.activeFilters.shop_id)?.name ?? management.activeFilters.shop_id }] : []),
    ...(management.activeFilters.current_production_step_id ? [{ label: 'Statut', value: steps.find((step) => step.id === management.activeFilters.current_production_step_id)?.label ?? management.activeFilters.current_production_step_id }] : []),
    ...(management.activeFilters.created_from || management.activeFilters.created_to ? [{ label: 'Période', value: `${management.activeFilters.created_from ?? '…'} → ${management.activeFilters.created_to ?? '…'}` }] : []),
  ] };

  return (
    <div className="w-full min-w-0" style={{ fontFamily: 'var(--font-ui)' }} data-testid="dashboard-orders-page">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-ink m-0" style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em', lineHeight: 1.05 }}>Commandes</h1>
          <p className="mt-2 mb-0 text-ink-muted text-sm">Toutes origines confondues, de la plus récente à la plus ancienne.</p>
        </div>
        <OrderExportPanel key={tenantId} unifiedSelection={exportSelection} />
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
          <select className={filterControlClass} value={visibleStatusFilter} onChange={(event) => changeVisibleStatusFilter(event.target.value)}>
            <option value="">Tous</option>
            <optgroup label="Administratif">
              <option value="admin:draft">{STATUS_LABELS.draft.label}</option>
              <option value="admin:validated">{STATUS_LABELS.validated.label}</option>
              <option value="admin:cancelled">{STATUS_LABELS.cancelled.label}</option>
            </optgroup>
            {steps.length > 0 && <optgroup label="Production">
              {steps.filter((step) => step.is_active).map((step) => <option key={step.id} value={`step:${step.id}`}>{step.label}</option>)}
            </optgroup>}
          </select>
        </label>
        <label className={`${filterLabelClass} flex-[1_1_180px]`}> Boutique
          <select className={filterControlClass} value={filters.shop_id ?? ''} onChange={(event) => change('shop_id', event.target.value)}>
            <option value="">Toutes</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name || shop.slug}</option>)}
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
      {selectedOrderIds.size > 0 && (
        <section className="mb-3 flex flex-wrap items-end gap-3 rounded-md border border-brand/30 bg-brand/5 p-3" aria-label="Changement de statut en lot">
          <p className="mr-auto self-center text-sm font-medium text-ink">{selectedOrderIds.size} commande{selectedOrderIds.size > 1 ? 's' : ''} sélectionnée{selectedOrderIds.size > 1 ? 's' : ''}</p>
          <label className={`${filterLabelClass} min-w-[220px]`}>Nouveau statut
            <select className={filterControlClass} value={bulkAction} disabled={bulkBusy} onChange={(event) => setBulkAction(event.target.value)}>
              <option value="">Choisir un statut</option>
              <optgroup label="Administratif">
                <option value="validate">Valider les commandes</option>
              </optgroup>
              {steps.some((step) => step.is_active) && <optgroup label="Production">
                {steps.filter((step) => step.is_active).map((step) => <option key={step.id} value={`step:${step.id}`}>{step.label}</option>)}
              </optgroup>}
            </select>
          </label>
          <button className={`${inputClass} h-9 whitespace-nowrap disabled:opacity-50`} type="button" disabled={!bulkAction || bulkBusy} onClick={() => void applyBulkStatus()}>{bulkBusy ? 'Application…' : 'Appliquer'}</button>
          <button className={`${inputClass} h-9 whitespace-nowrap`} type="button" disabled={bulkBusy} onClick={() => { setSelectedOrderIds(new Set()); setBulkAction(''); setBulkResult(null); }}>Effacer la sélection</button>
        </section>
      )}
      {bulkResult && (
        <div className={`mb-3 rounded border p-3 text-sm ${bulkResult.failures.length > 0 ? 'border-err-fg/30 bg-err-bg text-err-fg' : 'border-ok-fg/30 bg-ok-bg text-ok-fg'}`} role={bulkResult.failures.length > 0 ? 'alert' : 'status'}>
          <p>{bulkResult.succeeded} commande{bulkResult.succeeded > 1 ? 's' : ''} mise{bulkResult.succeeded > 1 ? 's' : ''} à jour. {bulkResult.failures.length > 0 ? `${bulkResult.failures.length} échec${bulkResult.failures.length > 1 ? 's' : ''}.` : ''}</p>
          {bulkResult.failures.length > 0 && <ul className="mt-1 list-disc pl-5">{bulkResult.failures.map((failure) => <li key={failure.orderId}>{failure.label} : {failure.message}</li>)}</ul>}
        </div>
      )}
      <OrderHistoryTable
        orders={management.orders} loading={management.loading} error={management.error}
        auditApi={auditApi} appearance="dashboard" serverManaged
        onOpenOrder={(order) => navigate(tenantPath(`/dashboard/orders/${order.id}`))}
        onOpenCustomer={(order) => { if (order.customer_id) navigate(tenantPath(`/dashboard/customers/${order.customer_id}`)); }}
        selectedOrderIds={selectedOrderIds}
        onSelectedOrderIdsChange={(ids) => { setSelectedOrderIds(ids); setBulkResult(null); }}
        renderStatus={(order) => {
          const visible = resolveVisibleOrderStatus(order.status, order.currentProductionStepId, steps);
          const tone = visible.tone === 'error' ? 'border-err-fg/30 bg-err-bg text-err-fg' : visible.tone === 'info' ? 'border-brand/30 bg-brand/5 text-brand' : 'border-line bg-bg text-ink-2';
          return <span aria-label={`Statut: ${visible.label}`} className={`inline-block max-w-full whitespace-normal rounded border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] ${tone}`}>{visible.label}</span>;
        }}
        renderStatusAction={(order) => {
          const readOnlyReason = productionStepReadOnlyReason(order.status);
          const currentStatusLabel = resolveVisibleOrderStatus(order.status, order.currentProductionStepId, steps).label;
          return <OrderStatusButton
            orderId={order.id}
            label="Statut"
            currentStatusLabel={currentStatusLabel}
            {...(readOnlyReason === undefined ? {} : { readOnlyReason })}
            onChanged={() => void management.reload()}
            onAdministrativeChanged={() => management.reload()}
          />;
        }}
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
