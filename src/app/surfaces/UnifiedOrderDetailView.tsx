import { useEffect, useMemo, useState } from 'react';
import { Ban, Check, History, Loader2, Play, Truck } from 'lucide-react';
import { Link } from 'react-router';
import { CustomersApiClient, type CustomerDetailDto } from '@/modules/customers';
import { OrderDocumentPanel, OrderStatusButton } from '@/modules/commercial-orders/ui';
import { OrderFilesBlock } from '@/modules/order-files/ui';
import { OrdersApiClient, type UnifiedOrderDetail } from '@/modules/orders';
import { OrderAuditTrailModal } from '@/modules/orders/ui/storefront/OrderAuditTrailModal';
import { CancelOrderConfirmDialog } from '@/modules/orders/ui/storefront/CancelOrderConfirmDialog';
import { ValidateOrderConfirmDialog } from '@/modules/orders/ui/storefront/ValidateOrderConfirmDialog';
import type { OrderUI } from '@/modules/orders/ui/storefront/PortalOrders.helpers';
import { OrderMetadataEditor } from '@/modules/orders/ui/workspace/OrderMetadataEditor';
import { productionStepReadOnlyReason, resolveVisibleOrderStatus } from '@/modules/orders/ui/workspace/order-status-presentation';
import { OrderUploadLinksPanel } from '@/modules/order-upload-links/ui';
import { ProductionStepsApiClient, type ProductionStepDto } from '@/modules/production-steps';
import { useUserCapability } from '@/modules/roles/ui/hooks';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { SafeDescriptionHtml } from '@/shared/presentation/SafeDescriptionHtml';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
const actionClass = 'inline-flex items-center gap-1.5 rounded border border-line bg-paper px-3 py-2 text-sm text-ink hover:border-brand disabled:cursor-not-allowed disabled:opacity-50';

type CommonLine = Readonly<{
  id: string;
  label: string;
  descriptionHtml: string | null;
  configuration: Record<string, unknown> | null;
  quantity: number;
  unitPriceHt: string;
  lineTotalHt: string;
  priceOrigin: string;
}>;

export function UnifiedOrderDetailView({
  order,
  etag,
  api,
  onChanged,
}: Readonly<{
  order: UnifiedOrderDetail;
  etag: string | null;
  api: OrdersApiClient;
  onChanged: (result: Readonly<{ data: UnifiedOrderDetail; etag: string | null }>) => void;
}>) {
  const tenantPath = useTenantPath();
  const customersApi = useWorkspaceApi(CustomersApiClient);
  const productionStepsApi = useWorkspaceApi(ProductionStepsApiClient);
  const { currentTenant } = useTenant();
  const { hasIt: canValidate } = useUserCapability('can_validate');
  const { hasIt: canModify } = useUserCapability('can_modify');
  const [customer, setCustomer] = useState<CustomerDetailDto | null>(null);
  const [productionSteps, setProductionSteps] = useState<readonly ProductionStepDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setCustomer(null);
    if (order.origin !== 'quote') return () => { active = false; };
    void customersApi.getDetail(order.detail.customer_id).then(
      (result) => { if (active) setCustomer(result); },
      () => { if (active) setCustomer(null); },
    );
    return () => { active = false; };
  }, [customersApi, order]);

  useEffect(() => {
    let active = true;
    void productionStepsApi.list().then(
      (result) => { if (active) setProductionSteps(result.data); },
      () => { if (active) setProductionSteps([]); },
    );
    return () => { active = false; };
  }, [productionStepsApi, order.id]);

  const lines = useMemo(() => normalizeLines(order), [order]);
  const status = resolveVisibleOrderStatus(order.status, order.current_production_step_id, productionSteps);
  const statusTone = status.tone === 'error' ? 'border-err-fg/30 bg-err-bg text-err-fg' : status.tone === 'info' ? 'border-brand/30 bg-brand/5 text-brand' : 'border-line bg-bg text-ink-2';
  const statusReadOnlyReason = productionStepReadOnlyReason(order.status);
  const isAdmin = currentTenant?.myRole === 'admin';
  const shortId = order.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  const customerName = order.origin === 'storefront'
    ? order.detail.customerName
    : customerDisplayName(customer);
  const customerEmail = order.origin === 'storefront'
    ? order.detail.customerEmail
    : quoteCustomerEmail(order, customer);
  const shopName = order.origin === 'storefront' ? order.detail.shopName : null;
  const displayNumber = order.number ?? `#${shortId}`;
  const orderUi = toOrderUi(order, lines, customerName, customerEmail);

  const reload = async () => {
    const fresh = await api.getUnifiedDetailWithEtag(order.id);
    onChanged(fresh);
  };

  const transition = async (
    toStatus: 'cancelled' | 'validated' | 'in_production' | 'shipped',
    acknowledgeUnverifiedPrices = false,
  ): Promise<string | null> => {
    if (busy) return 'Une autre action est déjà en cours.';
    setBusy(true);
    setError(null);
    try {
      await api.transition(order.id, {
        toStatus,
        reason: null,
        idempotencyKey: `order-detail:${order.id}:${toStatus}:${crypto.randomUUID()}`,
        acknowledgeUnverifiedPrices,
      });
      await reload();
      return null;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'La transition a échoué.';
      setError(message);
      return message;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-[1200px] space-y-6" data-testid="unified-order-detail">
      <Link to={tenantPath('/dashboard/orders')} className="text-sm text-ink-muted hover:text-ink">
        Retour aux commandes
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-ink-muted">Commande</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{displayNumber}</h1>
          <p className="mt-1 text-sm text-ink-muted">Référence complète : {order.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded border px-2.5 py-1 text-xs font-mono uppercase ${statusTone}`}>{status.label}</span>
          <OrderStatusButton orderId={order.id} label="Statut" currentStatusLabel={status.label} {...(statusReadOnlyReason === undefined ? {} : { readOnlyReason: statusReadOnlyReason })} onChanged={() => void reload()} />
        </div>
      </header>

      {error && <p className="rounded border border-err-fg/30 bg-err-bg p-3 text-sm text-err-fg">{error}</p>}

      <OrderMetadataEditor order={order} etag={etag} api={api} onSaved={onChanged} />

      <dl className="grid grid-cols-1 gap-4 rounded-xl border border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Origine" value={order.origin === 'storefront' ? 'Boutique' : 'Devis'} />
        <Fact label="Boutique" value={shopName ?? 'Non renseignée'} />
        <Fact label="Client" value={customerName ?? 'Non identifié'} link={order.customer_id ? tenantPath(`/dashboard/customers/${order.customer_id}`) : null} />
        <Fact label="E-mail" value={customerEmail ?? 'Non renseigné'} />
        <Fact label="Créée le" value={dateFormatter.format(new Date(order.created_at))} />
        <Fact label="Dernière modification" value={dateFormatter.format(new Date(order.updated_at))} />
        <Fact label="Devis d’origine" value={order.quote_id ? 'Voir le devis' : 'Non applicable'} link={order.quote_id ? tenantPath(`/dashboard/commercial-quotes/${order.quote_id}`) : null} />
      </dl>

      <section className="rounded-xl border border-line">
        <div className="border-b border-line px-4 py-3"><h2 className="font-semibold text-ink">Lignes de commande</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted">
              <th className="px-4 py-3">Produit</th><th className="px-4 py-3">Configuration</th>
              <th className="px-4 py-3 text-right">Quantité</th><th className="px-4 py-3 text-right">Prix unitaire HT</th>
              <th className="px-4 py-3 text-right">Total HT</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {lines.map((line) => <tr key={line.id} data-order-line-id={line.id}>
                <td className="px-4 py-3 align-top text-ink"><div className="font-medium">{line.label}</div><SafeDescriptionHtml html={line.descriptionHtml} className="mt-1 text-xs text-ink-muted" /><p className="mt-1 text-xs text-ink-muted">Prix : {line.priceOrigin}</p></td>
                <td className="max-w-md px-4 py-3 align-top"><TechnicalConfiguration value={line.configuration} /></td>
                <td className="px-4 py-3 text-right align-top text-ink">{line.quantity}</td>
                <td className="px-4 py-3 text-right align-top font-mono text-ink">{formatMoney(line.unitPriceHt, order.currency)}</td>
                <td className="px-4 py-3 text-right align-top font-mono font-medium text-ink">{formatMoney(line.lineTotalHt, order.currency)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-line p-4"><dl className="space-y-2 sm:text-right">
        <Total label="Total HT" value={formatMoney(order.total_ht, order.currency)} />
        <Total label="TVA" value={formatMoney((Number(order.total_ttc) - Number(order.total_ht)).toFixed(2), order.currency)} />
        <Total label="Total TTC" value={formatMoney(order.total_ttc, order.currency)} strong />
      </dl></section>

      <OrderFilesBlock orderId={order.id} lines={lines.map((line) => ({ id: line.id, label: line.label }))} />
      <OrderDocumentPanel orderId={order.id} />
      <OrderUploadLinksPanel orderId={order.id} />

      <section className="flex flex-wrap gap-2 rounded-xl border border-line p-4" aria-label="Actions sur la commande">
        <button type="button" onClick={() => setHistoryOpen(true)} className={actionClass}><History className="h-4 w-4" /> Historique</button>
        {order.status === 'draft' && (canValidate || isAdmin) && <button type="button" disabled={busy} onClick={() => setValidateOpen(true)} className={actionClass}><Check className="h-4 w-4" />{order.has_unverified_prices ? 'Valider et accepter les prix non vérifiés' : 'Valider'}</button>}
        {order.status === 'draft' && <button type="button" disabled={busy} onClick={() => setCancelOpen(true)} className={`${actionClass} text-err-fg`}><Ban className="h-4 w-4" /> Annuler</button>}
        {order.status === 'validated' && (canModify || isAdmin) && <button type="button" disabled={busy} onClick={() => void transition('in_production')} className={actionClass}><Play className="h-4 w-4" /> Démarrer la production</button>}
        {order.status === 'in_production' && (canModify || isAdmin) && <button type="button" disabled={busy} onClick={() => void transition('shipped')} className={actionClass}><Truck className="h-4 w-4" /> Marquer expédiée</button>}
        {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-ink-muted" aria-label="Action en cours" />}
      </section>

      <OrderAuditTrailModal orderId={historyOpen ? order.id : null} orderShortId={displayNumber} ordersApi={api} onClose={() => setHistoryOpen(false)} />
      <CancelOrderConfirmDialog orderId={cancelOpen ? order.id : null} orderShortId={displayNumber} onConfirm={() => transition('cancelled')} onClose={() => setCancelOpen(false)} />
      <ValidateOrderConfirmDialog order={validateOpen ? orderUi : null} onConfirm={(_orderId, acknowledge) => transition('validated', acknowledge)} onClose={() => setValidateOpen(false)} />
    </div>
  );
}

function normalizeLines(order: UnifiedOrderDetail): readonly CommonLine[] {
  if (order.origin === 'storefront') return order.detail.items.map((line) => ({
    id: line.id, label: line.productLabel, descriptionHtml: null, configuration: line.clariprintOptions,
    quantity: line.quantity, unitPriceHt: line.unitPriceHt, lineTotalHt: line.lineTotalHt,
    priceOrigin: priceOriginLabel(line.priceOrigin),
  }));
  return order.detail.lines.map((line) => ({
    id: line.id, label: line.label, descriptionHtml: line.description_html, configuration: line.product_config,
    quantity: line.quantity, unitPriceHt: (Number(line.sale_price) / line.quantity).toFixed(2),
    lineTotalHt: line.sale_price, priceOrigin: 'devis',
  }));
}

function toOrderUi(order: UnifiedOrderDetail, lines: readonly CommonLine[], customerName: string | null, customerEmail: string | null): OrderUI {
  return { id: order.id, source: 'v1_1', date: order.created_at, customer_name: customerName ?? '', customer_email: customerEmail ?? '',
    items: lines.map((line) => ({ name: line.label, qty: line.quantity, price_ht: Number(line.unitPriceHt), priceOrigin: order.origin === 'storefront' ? order.detail.items.find((item) => item.id === line.id)?.priceOrigin ?? null : 'quoted' })),
    total_ht: Number(order.total_ht), total_ttc: Number(order.total_ttc), status: order.status, hasUnverifiedPrices: order.has_unverified_prices };
}

function quoteCustomerEmail(order: Extract<UnifiedOrderDetail, { origin: 'quote' }>, customer: CustomerDetailDto | null): string | null {
  const selected = customer?.contacts.find((contact) => contact.id === order.detail.customer_contact_id)
    ?? customer?.contacts.find((contact) => contact.is_primary) ?? null;
  return selected?.email ?? null;
}

function customerDisplayName(customer: CustomerDetailDto | null): string | null {
  if (!customer) return null;
  return customer.type === 'company' ? customer.company_name : [customer.first_name, customer.last_name].filter(Boolean).join(' ') || null;
}

function Fact({ label, value, link = null }: { label: string; value: string; link?: string | null }) {
  return <div><dt className="text-xs uppercase tracking-wider text-ink-muted">{label}</dt><dd className="mt-1 text-sm text-ink">{link ? <Link to={link} className="hover:text-brand hover:underline">{value}</Link> : value}</dd></div>;
}
function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex justify-between gap-6 sm:justify-end"><dt className="text-sm text-ink-muted">{label}</dt><dd className={strong ? 'font-mono font-semibold text-ink' : 'font-mono text-sm text-ink'}>{value}</dd></div>;
}
function TechnicalConfiguration({ value }: { value: Record<string, unknown> | null }) {
  const entries = value ? Object.entries(value) : [];
  if (entries.length === 0) return <span className="text-xs text-ink-muted">Non renseignée</span>;
  return <dl className="space-y-1 text-xs">{entries.map(([key, item]) => <div key={key} className="flex gap-2"><dt className="shrink-0 text-ink-muted">{key}</dt><dd className="break-all text-ink">{displayValue(item)}</dd></div>)}</dl>;
}
function displayValue(value: unknown): string { return value === null || value === undefined || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value); }
function formatMoney(value: string, currency: string): string { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(value)); }
function priceOriginLabel(origin: 'catalog' | 'quoted' | 'client_unverified' | 'legacy'): string { return origin === 'catalog' ? 'catalogue vérifié' : origin === 'quoted' ? 'devis' : origin === 'client_unverified' ? 'non vérifié' : 'donnée reprise'; }
