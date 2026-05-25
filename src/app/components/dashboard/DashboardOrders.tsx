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
import { supabase } from '/utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useShops } from '../../contexts/ShopsContext';
import { applyTax, getTaxRate } from '../../utils/tax';
import {
  type OrderUI,
  type ShopOrderRow,
  type TenantOrderRow,
  mergeAndSortOrders,
  normalizeShopOrder,
  normalizeTenantOrder,
} from '../shop/portal/PortalOrders.helpers';
import { OrderHistoryTable } from '../shop/portal/OrderHistoryTable';
import { CancelOrderConfirmDialog } from '../shop/portal/CancelOrderConfirmDialog';
import { ValidateOrderConfirmDialog } from '../shop/portal/ValidateOrderConfirmDialog';
import { formatCancelErrorMessage } from '../shop/portal/orderCancellation.helpers';
import { formatValidateErrorMessage } from '../shop/portal/orderValidation.helpers';

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

  const loadOrders = useCallback(async (cancelled: { current: boolean }) => {
    if (!user || !currentTenant) return;
    if (shops.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const taxRate = getTaxRate(currentTenant);
    const taxedTotal = (ht: number) => applyTax(ht, taxRate);
    const shopIds = shops.map((s) => s.id);

    const queryA = supabase
      .from('shop_orders')
      .select('*')
      .in('shop_id', shopIds)
      .order('created_at', { ascending: false })
      .limit(100);

    const queryB = supabase
      .from('tenant_orders')
      .select(
        'id, shop_id, tenant_id, created_by, status, total_ht, currency, notes, created_at, tenant_order_items(product_label, quantity, unit_price_ht, line_total_ht)',
      )
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false })
      .limit(100);

    const [resA, resB] = await Promise.all([queryA, queryB]);
    if (cancelled.current) return;

    const legacy: DashboardOrderUI[] = [];
    const v11: DashboardOrderUI[] = [];

    if (resA.error) {
      console.warn('[DashboardOrders] query shop_orders failed:', resA.error.message);
    } else if (Array.isArray(resA.data)) {
      for (const row of resA.data as ShopOrderRow[]) {
        legacy.push({ ...normalizeShopOrder(row), shop_id: row.shop_id });
      }
    }

    if (resB.error) {
      console.warn('[DashboardOrders] query tenant_orders failed:', resB.error.message);
    } else if (Array.isArray(resB.data)) {
      for (const row of resB.data as TenantOrderRow[]) {
        v11.push({ ...normalizeTenantOrder(row, taxedTotal), shop_id: row.shop_id });
      }
    }

    if (resA.error && resB.error) {
      setError(`${resA.error.message} / ${resB.error.message}`);
      setLoading(false);
      return;
    }

    const merged = mergeAndSortOrders(legacy, v11) as DashboardOrderUI[];
    setOrders(merged);
    setLoading(false);
  }, [user, currentTenant, shops]);

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
    const { error: rpcErr } = await supabase.rpc('update_tenant_order_status', {
      p_order_id: orderId,
      p_new_status: 'cancelled',
      p_reason: null,
    });
    if (rpcErr) {
      console.warn('[DashboardOrders] cancel RPC failed:', rpcErr.message);
      return formatCancelErrorMessage(rpcErr);
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
    const { error: rpcErr } = await supabase.rpc('update_tenant_order_status', {
      p_order_id: orderId,
      p_new_status: 'validated',
      p_reason: null,
    });
    if (rpcErr) {
      console.warn('[DashboardOrders] validate RPC failed:', rpcErr.message);
      return formatValidateErrorMessage(rpcErr);
    }
    await loadOrders({ current: false });
    return null;
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Commandes</h2>
        <p className="text-sm text-gray-600">
          {orders.length} commande(s) enregistrée(s) sur l ensemble de vos boutiques.
        </p>
      </div>

      <OrderHistoryTable
        orders={orders}
        loading={loading}
        error={error}
        persistKey={currentTenant ? `orderHistory:dashboard:${currentTenant.id}` : undefined}
        onCancelOrder={handleCancelOrderRequest}
        onValidateOrder={handleValidateOrderRequest}
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
