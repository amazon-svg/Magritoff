/**
 * DashboardOrders — Vue agrégée des commandes du tenant.
 *
 * S-DASHBOARD-ORDERS-DUAL (Sprint 4 Phase 1 complement, 2026-05-18) :
 * remplace l'ancien placeholder et lit le stockage canonique tenant_orders.
 *
 * S3.1 (Sprint 5, 2026-05-23) : refactor pour deleguer rendu/filtres/tri
 * au composant <OrderHistoryTable>, avec extraColumn 'Boutique' pour
 * afficher le slug par ligne.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/modules/account/ui/runtime';
import { useTenant } from '@/modules/tenants/ui/runtime';
import { useShops } from '@/modules/shops/ui/runtime';
import { OrderHistoryTable } from '@/modules/orders/ui/storefront/OrderHistoryTable';
import { useTenantPath } from '@/modules/tenants/ui/hooks';
import { CommercialOrdersApiClient, type CommercialOrderDto } from '@/modules/commercial-orders';
import { CustomersApiClient, type CustomerDetailDto } from '@/modules/customers';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import {
  type DashboardOrderUI,
  useDashboardOrderManagement,
} from '@/modules/orders/ui/hooks/useDashboardOrderManagement';

export function DashboardOrders() {
  const navigate = useNavigate();
  const tenantPath = useTenantPath();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const commercialOrdersApi = useWorkspaceApi(CommercialOrdersApiClient);
  const customersApi = useWorkspaceApi(CustomersApiClient);
  const { shops } = useShops();
  const shopIds = useMemo(() => shops.map((shop) => shop.id), [shops]);
  const {
    orders,
    loading,
    error,
    auditApi,
  } = useDashboardOrderManagement({
    enabled: Boolean(user),
    tenantId: currentTenant?.id ?? null,
    shopIds,
  });

  const [quoteOrders, setQuoteOrders] = useState<DashboardOrderUI[]>([]);
  const [quoteOrdersLoading, setQuoteOrdersLoading] = useState(true);
  const [quoteOrdersError, setQuoteOrdersError] = useState<string | null>(null);

  // Modèle de lecture commun : les deux workflows partagent désormais les
  // tables orders. Les deux API restent des projections de compatibilité le
  // temps d'unifier leurs contrats de détail et de transition.
  useEffect(() => {
    let active = true;
    if (!user || !currentTenant) {
      setQuoteOrders([]);
      setQuoteOrdersLoading(false);
      setQuoteOrdersError(null);
      return () => { active = false; };
    }

    setQuoteOrdersLoading(true);
    setQuoteOrdersError(null);
    void loadAllCommercialOrders(commercialOrdersApi).then(async (commercialOrders) => {
      const customerIds = [...new Set(commercialOrders.map((order) => order.customer_id))];
      const customers = await Promise.all(
        customerIds.map(async (customerId) => {
          try {
            return [customerId, await customersApi.getDetail(customerId)] as const;
          } catch {
            return null;
          }
        }),
      );
      if (!active) return;
      const customersById = new Map<string, CustomerDetailDto>();
      for (const entry of customers) {
        if (entry) customersById.set(entry[0], entry[1]);
      }
      setQuoteOrders(commercialOrders.map((order) => commercialOrderToDashboard(order, customersById.get(order.customer_id))));
    }).catch((cause: unknown) => {
      if (!active) return;
      setQuoteOrders([]);
      setQuoteOrdersError(cause instanceof Error ? cause.message : 'Chargement des commandes issues de devis impossible.');
    }).finally(() => {
      if (active) setQuoteOrdersLoading(false);
    });

    return () => { active = false; };
  }, [commercialOrdersApi, currentTenant, customersApi, user]);

  const unifiedOrders = useMemo(
    () => [...orders, ...quoteOrders].sort((left, right) => Date.parse(right.date) - Date.parse(left.date)),
    [orders, quoteOrders],
  );

  // Fix 2026-05-25 : Map shop_id -> { name, slug } pour afficher le NOM
  // humain dans la colonne Boutique (et plus le slug technique qui ressemble
  // à wuqezh-8ggfvk pour les boutiques créées sans slug humain explicite).
  const shopInfoById = useMemo(() => {
    const map = new Map<string, { name: string; slug: string }>();
    for (const s of shops) {
      map.set(s.id, { name: s.name, slug: s.slug });
    }
    return map;
  }, [shops]);

  // Helper : retourne le label humain à afficher (name préféré, fallback slug puis '—').
  const shopDisplayLabel = (shopId: string): string => {
    const info = shopInfoById.get(shopId);
    if (!info) return '—';
    return info.name?.trim() || info.slug || '—';
  };

  return (
    <div
      className="max-w-[1400px]"
      style={{ fontFamily: 'var(--font-ui)' }}
      data-testid="dashboard-orders-page"
    >
      <div className="mb-6">
        <h1
          className="text-ink m-0"
          style={{ fontWeight: 300, fontSize: '34px', letterSpacing: '-0.025em', lineHeight: 1.05 }}
        >
          Commandes
        </h1>
        <p className="mt-2 mb-0 text-ink-muted" style={{ fontSize: '13.5px' }}>
          {unifiedOrders.length} commande{unifiedOrders.length > 1 ? 's' : ''} enregistrée{unifiedOrders.length > 1 ? 's' : ''}, toutes origines confondues.
        </p>
      </div>

      <OrderHistoryTable
        orders={unifiedOrders}
        loading={loading || quoteOrdersLoading}
        error={[error, quoteOrdersError].filter(Boolean).join(' · ') || null}
        auditApi={auditApi}
        appearance="dashboard"
        onOpenOrder={(order) => navigate(tenantPath(`/dashboard/orders/${order.id}`))}
        onOpenCustomer={(order) => {
          if (order.customer_id) navigate(tenantPath(`/dashboard/customers/${order.customer_id}`));
        }}
        persistKey={currentTenant ? `orderHistory:dashboard:${currentTenant.id}` : undefined}
        extraColumn={{
          header: 'Origine',
          position: 'after-date',
          render: (o) => (
            <span className="text-xs">
              {(o as DashboardOrderUI).source === 'commercial'
                ? 'Devis'
                : shopDisplayLabel((o as DashboardOrderUI).shop_id)}
            </span>
          ),
          // Fix 2026-05-25 : retrait du sortValue (lesson : sur colonne
          // catégorielle, l'usage primaire est le filtre, pas le tri).
        }}
        extraFilter={{
          label: 'Origine',
          getOptionKey: (o) => (o as DashboardOrderUI).shop_id,
          getOptionLabel: (o) => (o as DashboardOrderUI).source === 'commercial'
            ? 'Devis'
            : shopDisplayLabel((o as DashboardOrderUI).shop_id),
        }}
      />

    </div>
  );
}

async function loadAllCommercialOrders(api: CommercialOrdersApiClient): Promise<readonly CommercialOrderDto[]> {
  const orders: CommercialOrderDto[] = [];
  let pageCursor: string | undefined;
  do {
    const page = await api.list({ pageSize: 100, ...(pageCursor ? { pageCursor } : {}) });
    orders.push(...page.items);
    pageCursor = page.nextCursor ?? undefined;
  } while (pageCursor);
  return orders;
}

function commercialOrderToDashboard(order: CommercialOrderDto, customer?: CustomerDetailDto): DashboardOrderUI {
  return {
    id: order.id,
    number: order.number,
    customer_id: order.customer_id,
    source: 'commercial',
    date: order.created_at,
    customer_name: customer ? customerName(customer) : 'Client',
    customer_email: '',
    items: [],
    total_ht: Number(order.totals.net_total),
    total_ttc: Number(order.totals.total_incl_tax),
    status: order.status,
    hasUnverifiedPrices: false,
    shop_id: '__quote__',
  };
}

function customerName(customer: CustomerDetailDto): string {
  if (customer.type === 'company') return customer.company_name ?? 'Client';
  return [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Client';
}
