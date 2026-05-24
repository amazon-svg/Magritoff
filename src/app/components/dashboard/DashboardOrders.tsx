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

import { useEffect, useMemo, useState } from 'react';
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

  // Map shop_id -> shop slug pour la colonne Boutique
  const shopSlugById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of shops) {
      map.set(s.id, s.slug);
    }
    return map;
  }, [shops]);

  useEffect(() => {
    if (!user || !currentTenant) return;
    if (shops.length === 0) {
      // Pas de boutique = pas de commandes possible. On evite la query.
      setOrders([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const taxRate = getTaxRate(currentTenant);
    const taxedTotal = (ht: number) => applyTax(ht, taxRate);
    const shopIds = shops.map((s) => s.id);

    (async () => {
      setLoading(true);
      setError(null);

      // Query A : shop_orders legacy pour toutes les boutiques du tenant.
      // RLS owner_user_id = auth.uid() autorise le owner a voir TOUTES.
      const queryA = supabase
        .from('shop_orders')
        .select('*')
        .in('shop_id', shopIds)
        .order('created_at', { ascending: false })
        .limit(100);

      // Query B : tenant_orders v1.1, scope direct par tenant_id.
      // Join inner tenant_order_items pour items.
      const queryB = supabase
        .from('tenant_orders')
        .select(
          'id, shop_id, tenant_id, created_by, status, total_ht, currency, notes, created_at, tenant_order_items(product_label, quantity, unit_price_ht, line_total_ht)',
        )
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      const [resA, resB] = await Promise.all([queryA, queryB]);
      if (cancelled) return;

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
    })();

    return () => {
      cancelled = true;
    };
  }, [user, currentTenant, shops]);

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
        extraColumn={{
          header: 'Boutique',
          position: 'after-date',
          render: (o) => (
            <span className="font-mono text-xs">
              {shopSlugById.get((o as DashboardOrderUI).shop_id) ?? '—'}
            </span>
          ),
          // S3.1 ext (2026-05-23) : tri par slug boutique pour imprimeurs multi-boutiques.
          sortValue: (o) => shopSlugById.get((o as DashboardOrderUI).shop_id) ?? '',
        }}
      />
    </div>
  );
}
