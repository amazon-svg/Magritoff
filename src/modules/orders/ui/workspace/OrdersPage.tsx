/**
 * DashboardOrders — Vue agrégée des commandes du tenant.
 *
 * S-DASHBOARD-ORDERS-DUAL (Sprint 4 Phase 1 complement, 2026-05-18) :
 * remplace l ancien placeholder. Dual-read shop_orders + tenant_orders.
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
import { type OrderUI } from '@/modules/orders/ui/storefront/PortalOrders.helpers';
import { OrderHistoryTable } from '@/modules/orders/ui/storefront/OrderHistoryTable';
import { CancelOrderConfirmDialog } from '@/modules/orders/ui/storefront/CancelOrderConfirmDialog';
import { ValidateOrderConfirmDialog } from '@/modules/orders/ui/storefront/ValidateOrderConfirmDialog';
import { useUserCapability } from '@/modules/roles/ui/hooks';
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
    cancel,
    validate,
    startProduction,
    markShipped,
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

  // S3.4 : modal annulation. orderToCancel = null → modal fermé.
  const [orderToCancel, setOrderToCancel] = useState<DashboardOrderUI | null>(null);
  // Fix 2026-05-25 : modal validation. orderToValidate = null → modal fermé.
  const [orderToValidate, setOrderToValidate] = useState<DashboardOrderUI | null>(null);

  // S-USERS-REFONTE Phase A (2026-05-25) : le bouton "Valider" est role-driven.
  // Visible uniquement si l'utilisateur courant a la capability can_validate
  // via au moins un rôle actif dans le tenant (preset Owner / Admin /
  // Validateur par défaut). Évite que les Acheteurs voient un bouton qui
  // serait refusé par le RPC (UX confusion).
  const { hasIt: canValidate } = useUserCapability('can_validate');
  // S-ORDER-ROLES-3-UI (2026-06-09) : Démarrer la production + Marquer
  // expédiée gardes par can_modify (preset Owner / Admin / Validateur /
  // Producteur). Cohérence avec PortalOrders tab "À produire" mais
  // accessible à l'admin tenant sur l'ensemble des boutiques.
  const { hasIt: canModifyProduction } = useUserCapability('can_modify');
  // Les admins sont aussi autorisés par la commande serveur. Ce fallback
  // évite de masquer le workflow si un tenant brownfield n'a pas encore son
  // assignation de rôle fonctionnel synchronisée avec tenant_members.
  const isTenantAdmin = currentTenant?.myRole === 'admin';

  // S3.4 : handlers cancel (admin tenant peut annuler n'importe quelle draft).
  const handleCancelOrderRequest = (order: OrderUI) => {
    setOrderToCancel(order as DashboardOrderUI);
  };

  const handleCancelConfirm = async (orderId: string): Promise<string | null> => {
    return cancel(orderId);
  };

  // Fix 2026-05-25 : handlers validation (admin tenant uniquement —
  // RPC matrice draft→validated réservée au profil admin ou option Commandes).
  const handleValidateOrderRequest = (order: OrderUI) => {
    setOrderToValidate(order as DashboardOrderUI);
  };

  const handleValidateConfirm = async (
    orderId: string,
    acknowledgeUnverifiedPrices: boolean,
  ): Promise<string | null> => {
    return validate(orderId, acknowledgeUnverifiedPrices);
  };

  // S-ORDER-ROLES-3-UI : transitions production (admin tenant via can_modify).
  // Sans modal de confirmation — actions tactiques rapides côté pilotage atelier.
  const handleStartProduction = (order: OrderUI) => startProduction(order);
  const handleMarkShipped = (order: OrderUI) => markShipped(order);

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
        persistKey={currentTenant ? `orderHistory:dashboard:${currentTenant.id}` : undefined}
        onCancelOrder={handleCancelOrderRequest}
        // S-USERS-REFONTE Phase A : bouton Valider visible uniquement si
        // l'utilisateur courant a la capability can_validate (via rôle actif).
        // Sinon, undefined => OrderHistoryTable masque le bouton.
        onValidateOrder={canValidate || isTenantAdmin ? handleValidateOrderRequest : undefined}
        // S-ORDER-ROLES-3-UI : boutons Démarrer prod + Marquer expédiée
        // role-driven via can_modify (preset Owner / Admin / Validateur /
        // Producteur). Sans modal de confirmation côté admin tenant.
        onStartProductionOrder={canModifyProduction || isTenantAdmin ? handleStartProduction : undefined}
        onMarkShippedOrder={canModifyProduction || isTenantAdmin ? handleMarkShipped : undefined}
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

      <CancelOrderConfirmDialog
        orderId={orderToCancel?.id ?? null}
        orderShortId={
          orderToCancel?.id ? orderToCancel.id.replace(/-/g, '').slice(0, 8).toUpperCase() : undefined
        }
        onConfirm={handleCancelConfirm}
        onClose={() => setOrderToCancel(null)}
      />

      <ValidateOrderConfirmDialog
        order={orderToValidate}
        onConfirm={handleValidateConfirm}
        onClose={() => setOrderToValidate(null)}
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
