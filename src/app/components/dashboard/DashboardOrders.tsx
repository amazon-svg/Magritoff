/**
 * DashboardOrders — Vue agregee toutes commandes du tenant (persona owner).
 *
 * S-DASHBOARD-ORDERS-DUAL (Sprint 4 Phase 1 complement, 2026-05-18) :
 * remplace l ancien placeholder. Dual-read shop_orders + tenant_orders.
 *
 * S3.1 (Sprint 5, 2026-05-23) : refactor pour deleguer rendu/filtres/tri
 * au composant <OrderHistoryTable>, avec extraColumn 'Boutique' pour
 * afficher le slug par ligne.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrdersApi } from '../../contexts/ModuleClientsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useShops } from '../../contexts/ShopsContext';
import {
  type OrderUI,
  orderSummaryToUi,
} from '../shop/portal/PortalOrders.helpers';
import { OrderHistoryTable } from '../shop/portal/OrderHistoryTable';
import { CancelOrderConfirmDialog } from '../shop/portal/CancelOrderConfirmDialog';
import { ValidateOrderConfirmDialog } from '../shop/portal/ValidateOrderConfirmDialog';
import { formatCancelErrorMessage } from '../shop/portal/orderCancellation.helpers';
import { formatValidateErrorMessage } from '../shop/portal/orderValidation.helpers';
import { useUserCapability } from '../../hooks/useUserCapability';

interface DashboardOrderUI extends OrderUI {
  shop_id: string;
}

export function DashboardOrders() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { shops } = useShops();
  const [orders, setOrders] = useState<DashboardOrderUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ordersApi = useOrdersApi();

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
  // Les owner/admin sont aussi autorisés par la commande serveur. Ce fallback
  // évite de masquer le workflow si un tenant brownfield n'a pas encore son
  // assignation de rôle fonctionnel synchronisée avec tenant_members.
  const isTenantAdmin = currentTenant?.myRole === 'owner' || currentTenant?.myRole === 'admin';

  const loadOrders = useCallback(async (cancelled: { current: boolean }) => {
    if (!user || !currentTenant) return;
    if (shops.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const shopIds = shops.map((s) => s.id);
    try {
      const response = await ordersApi.listTenantOrders(currentTenant.id, shopIds);
      if (cancelled.current) return;
      setOrders(response.orders.map((order) => ({ ...orderSummaryToUi(order), shop_id: order.shopId })));
    } catch (cause) {
      if (cancelled.current) return;
      const message = cause instanceof Error ? cause.message : 'Chargement des commandes impossible.';
      console.warn('[DashboardOrders] API read failed:', message);
      setError(message);
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, [user, currentTenant, shops, ordersApi]);

  useEffect(() => {
    const cancelled = { current: false };
    void loadOrders(cancelled);
    return () => {
      cancelled.current = true;
    };
  }, [loadOrders]);

  // S3.4 : handlers cancel (admin tenant peut annuler n'importe quelle draft).
  const handleCancelOrderRequest = (order: OrderUI) => {
    setOrderToCancel(order as DashboardOrderUI);
  };

  const handleCancelConfirm = async (orderId: string): Promise<string | null> => {
    const currentOrder = orders.find((o) => o.id === orderId);
    const fromStatus = currentOrder?.status ?? 'draft';
    try {
      await ordersApi.transition(orderId, {
        toStatus: 'cancelled',
        reason: null,
        idempotencyKey: transitionKey(orderId, fromStatus, 'cancelled'),
      });
    } catch (cause) {
      console.warn('[DashboardOrders] cancel API failed:', cause);
      return formatCancelErrorMessage(cause instanceof Error ? cause : null);
    }
    await loadOrders({ current: false });
    return null;
  };

  // Fix 2026-05-25 : handlers validation (admin tenant uniquement —
  // RPC matrice draft→validated réservée role owner/admin).
  const handleValidateOrderRequest = (order: OrderUI) => {
    setOrderToValidate(order as DashboardOrderUI);
  };

  const handleValidateConfirm = async (orderId: string): Promise<string | null> => {
    const currentOrder = orders.find((o) => o.id === orderId);
    const fromStatus = currentOrder?.status ?? 'draft';
    try {
      await ordersApi.transition(orderId, {
        toStatus: 'validated',
        reason: null,
        idempotencyKey: transitionKey(orderId, fromStatus, 'validated'),
      });
    } catch (cause) {
      console.warn('[DashboardOrders] validate API failed:', cause);
      return formatValidateErrorMessage(cause instanceof Error ? cause : null);
    }
    await loadOrders({ current: false });
    return null;
  };

  // S-ORDER-ROLES-3-UI : transitions production (admin tenant via can_modify).
  // Sans modal de confirmation — actions tactiques rapides côté pilotage atelier.
  const transitionProductionStatus = async (
    order: OrderUI,
    toStatus: 'in_production' | 'shipped',
  ): Promise<void> => {
    const fromStatus = order.status;
    try {
      await ordersApi.transition(order.id, {
        toStatus,
        reason: null,
        idempotencyKey: transitionKey(order.id, fromStatus, toStatus),
      });
    } catch (cause) {
      console.warn(`[DashboardOrders] transition ${fromStatus}→${toStatus} failed:`, cause);
      return;
    }
    await loadOrders({ current: false });
  };

  const handleStartProduction = (order: OrderUI) => transitionProductionStatus(order, 'in_production');
  const handleMarkShipped = (order: OrderUI) => transitionProductionStatus(order, 'shipped');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Commandes</h2>
        <p className="text-sm text-ink-muted">
          {orders.length} commande(s) enregistrée(s) sur l ensemble de vos boutiques.
        </p>
      </div>

      <OrderHistoryTable
        orders={orders}
        loading={loading}
        error={error}
        auditApi={ordersApi}
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
          header: 'Boutique',
          position: 'after-date',
          render: (o) => (
            <span className="text-xs">
              {shopDisplayLabel((o as DashboardOrderUI).shop_id)}
            </span>
          ),
          // Fix 2026-05-25 : retrait du sortValue (lesson : sur colonne
          // catégorielle, l'usage primaire est le filtre, pas le tri).
        }}
        extraFilter={{
          label: 'Boutique',
          getOptionKey: (o) => (o as DashboardOrderUI).shop_id,
          getOptionLabel: (o) => shopDisplayLabel((o as DashboardOrderUI).shop_id),
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
        orderId={orderToValidate?.id ?? null}
        orderShortId={
          orderToValidate?.id ? orderToValidate.id.replace(/-/g, '').slice(0, 8).toUpperCase() : undefined
        }
        onConfirm={handleValidateConfirm}
        onClose={() => setOrderToValidate(null)}
      />
    </div>
  );
}

function transitionKey(orderId: string, fromStatus: string, toStatus: string): string {
  return `order-transition:${orderId}:${fromStatus}:${toStatus}`;
}
