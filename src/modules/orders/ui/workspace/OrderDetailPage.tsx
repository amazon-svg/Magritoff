import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Ban, Check, History, Loader2, Play, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { OrdersApiClient } from '@/modules/orders/api/client';
import type { OrderDetail } from '@/modules/orders/api/contracts';
import { getStatusInfo } from '@/modules/orders/ui/helpers/orderStatus';
import { OrderAuditTrailModal } from '@/modules/orders/ui/storefront/OrderAuditTrailModal';
import { CancelOrderConfirmDialog } from '@/modules/orders/ui/storefront/CancelOrderConfirmDialog';
import { ValidateOrderConfirmDialog } from '@/modules/orders/ui/storefront/ValidateOrderConfirmDialog';
import type { OrderUI } from '@/modules/orders/ui/storefront/PortalOrders.helpers';
import { useUserCapability } from '@/modules/roles/ui/hooks';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { TEST_IDS } from '@/shared/presentation/testIds';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
const actionClass = 'inline-flex items-center gap-1.5 rounded border border-line bg-paper px-3 py-2 text-sm text-ink hover:border-brand disabled:cursor-not-allowed disabled:opacity-50';

export function DashboardShopOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const tenantPath = useTenantPath();
  const ordersApi = useWorkspaceApi(OrdersApiClient);
  const { currentTenant } = useTenant();
  const { hasIt: canValidate } = useUserCapability('can_validate');
  const { hasIt: canModify } = useUserCapability('can_modify');
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) {
      setError('Identifiant de commande absent.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOrder(await ordersApi.getDetail(orderId));
    } catch (cause) {
      setOrder(null);
      setError(cause instanceof Error ? cause.message : 'Chargement de la commande impossible.');
    } finally {
      setLoading(false);
    }
  }, [orderId, ordersApi]);

  useEffect(() => { void load(); }, [load]);

  const transition = async (
    toStatus: 'cancelled' | 'validated' | 'in_production' | 'shipped',
    acknowledgeUnverifiedPrices = false,
  ): Promise<string | null> => {
    if (!order || busy) return 'Une autre action est déjà en cours.';
    setBusy(true);
    setError(null);
    try {
      await ordersApi.transition(order.orderId, {
        toStatus,
        reason: null,
        idempotencyKey: `order-detail:${order.orderId}:${toStatus}:${crypto.randomUUID()}`,
        acknowledgeUnverifiedPrices,
      });
      await load();
      return null;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'La transition a échoué.';
      await load();
      setError(message);
      return message;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-ink-muted">Chargement de la commande…</p>;

  if (!order) {
    return (
      <div className="space-y-4">
        <BackToOrders to={tenantPath('/dashboard/orders')} />
        <p className="text-sm text-err-fg">{error ?? 'Commande introuvable.'}</p>
      </div>
    );
  }

  const status = getStatusInfo(order.status as Parameters<typeof getStatusInfo>[0]);
  const isAdmin = currentTenant?.myRole === 'admin';
  const shortId = order.orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const orderUi: OrderUI = {
    id: order.orderId,
    source: order.source,
    date: order.createdAt,
    customer_name: order.customerName ?? '',
    customer_email: order.customerEmail ?? '',
    items: order.items.map((item) => ({
      name: item.productLabel,
      qty: item.quantity,
      price_ht: Number(item.unitPriceHt),
      priceOrigin: item.priceOrigin,
    })),
    total_ht: Number(order.totalHt),
    total_ttc: Number(order.totalTtc),
    status: order.status,
    hasUnverifiedPrices: order.hasUnverifiedPrices,
  };

  return (
    <div className="max-w-[1200px] space-y-6" data-testid={TEST_IDS.shop.orderBackofficeDetail}>
      <BackToOrders to={tenantPath('/dashboard/orders')} />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-ink-muted">Commande boutique</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">#{shortId}</h1>
          <p className="mt-1 text-sm text-ink-muted">Référence complète : {order.orderId}</p>
        </div>
        <span className={`self-start rounded border px-2.5 py-1 text-xs font-mono uppercase ${status.className}`}>
          {status.label}
        </span>
      </header>

      {error && <p className="rounded border border-err-fg/30 bg-err-bg p-3 text-sm text-err-fg">{error}</p>}

      <section className="grid grid-cols-1 gap-4 rounded-xl border border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Boutique" value={order.shopName || 'Non renseignée'} />
        <Fact label="Client" value={order.customerName || 'Non identifié'} />
        <Fact label="E-mail" value={order.customerEmail || 'Non renseigné'} />
        <Fact label="Créée le" value={dateFormatter.format(new Date(order.createdAt))} />
        <Fact label="Dernière modification" value={dateFormatter.format(new Date(order.updatedAt))} />
        <Fact label="Source" value="Commande boutique" />
      </section>

      <section className="rounded-xl border border-line">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-semibold text-ink">Lignes de commande</h2>
        </div>
        {order.items.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">Aucune ligne enregistrée.</p>
        ) : (
          <div className="divide-y divide-line">
            {order.items.map((item) => (
              <article key={item.id} className="space-y-3 p-4" data-testid={TEST_IDS.shop.orderBackofficeLine}>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <div>
                    <h3 className="font-medium text-ink">{item.productLabel}</h3>
                    <p className="text-xs text-ink-muted">Quantité : {item.quantity}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-sm text-ink">{formatMoney(item.lineTotalHt, order.currency)} HT</p>
                    <p className="text-xs text-ink-muted">{formatMoney(item.unitPriceHt, order.currency)} HT / unité</p>
                  </div>
                </div>
                <TechnicalConfiguration value={item.clariprintOptions} />
                <p className="text-xs text-ink-muted">Origine du prix : {priceOriginLabel(item.priceOrigin)}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">{order.notes.trim() || 'Aucune note.'}</p>
        </div>
        <dl className="space-y-2 sm:text-right">
          <Total label="Total HT" value={formatMoney(order.totalHt, order.currency)} />
          <Total label="TVA" value={formatMoney((Number(order.totalTtc) - Number(order.totalHt)).toFixed(2), order.currency)} />
          <Total label="Total TTC" value={formatMoney(order.totalTtc, order.currency)} strong />
        </dl>
      </section>

      <section className="flex flex-wrap gap-2 rounded-xl border border-line p-4" aria-label="Actions sur la commande">
        <button type="button" onClick={() => setHistoryOpen(true)} className={actionClass}>
          <History className="h-4 w-4" /> Historique
        </button>
        {order.status === 'draft' && (canValidate || isAdmin) && (
          <button type="button" disabled={busy} onClick={() => setValidateOpen(true)} className={actionClass}>
            <Check className="h-4 w-4" /> {order.hasUnverifiedPrices ? 'Valider et accepter les prix non vérifiés' : 'Valider'}
          </button>
        )}
        {order.status === 'draft' && (
          <button type="button" disabled={busy} onClick={() => setCancelOpen(true)} className={`${actionClass} text-err-fg`}>
            <Ban className="h-4 w-4" /> Annuler
          </button>
        )}
        {order.status === 'validated' && (canModify || isAdmin) && (
          <button type="button" disabled={busy} onClick={() => void transition('in_production')} className={actionClass}>
            <Play className="h-4 w-4" /> Démarrer la production
          </button>
        )}
        {order.status === 'in_production' && (canModify || isAdmin) && (
          <button type="button" disabled={busy} onClick={() => void transition('shipped')} className={actionClass}>
            <Truck className="h-4 w-4" /> Marquer expédiée
          </button>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-ink-muted" aria-label="Action en cours" />}
      </section>

      <OrderAuditTrailModal
        orderId={historyOpen ? order.orderId : null}
        orderShortId={shortId}
        ordersApi={ordersApi}
        onClose={() => setHistoryOpen(false)}
      />
      <CancelOrderConfirmDialog
        orderId={cancelOpen ? order.orderId : null}
        orderShortId={shortId}
        onConfirm={() => transition('cancelled')}
        onClose={() => setCancelOpen(false)}
      />
      <ValidateOrderConfirmDialog
        order={validateOpen ? orderUi : null}
        onConfirm={(_orderId, acknowledge) => transition('validated', acknowledge)}
        onClose={() => setValidateOpen(false)}
      />
    </div>
  );
}

function BackToOrders({ to }: { to: string }) {
  return <Link to={to} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Retour aux commandes</Link>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wider text-ink-muted">{label}</p><p className="mt-1 text-sm text-ink">{value}</p></div>;
}

function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex justify-between gap-6 sm:justify-end"><dt className="text-sm text-ink-muted">{label}</dt><dd className={strong ? 'font-mono font-semibold text-ink' : 'font-mono text-sm text-ink'}>{value}</dd></div>;
}

function TechnicalConfiguration({ value }: { value: Record<string, unknown> | null }) {
  const entries = value ? Object.entries(value) : [];
  if (entries.length === 0) return <p className="text-xs text-ink-muted">Configuration technique non renseignée.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded bg-bg p-3 text-xs sm:grid-cols-2">
      {entries.map(([key, item]) => <div key={key} className="flex gap-2"><dt className="text-ink-muted">{key}</dt><dd className="text-ink">{displayTechnicalValue(item)}</dd></div>)}
    </dl>
  );
}

function displayTechnicalValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatMoney(value: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(value));
}

function priceOriginLabel(origin: OrderDetail['items'][number]['priceOrigin']): string {
  if (origin === 'catalog') return 'catalogue vérifié';
  if (origin === 'quoted') return 'devis';
  if (origin === 'client_unverified') return 'prix non vérifié';
  return 'donnée reprise';
}
