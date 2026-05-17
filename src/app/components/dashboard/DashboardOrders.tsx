/**
 * DashboardOrders — Vue agregee toutes commandes du tenant (persona owner).
 *
 * S-DASHBOARD-ORDERS-DUAL (Sprint 4 Phase 1 complement, 2026-05-18) :
 * remplace l ancien placeholder (qui queryait une table `orders` inexistante).
 *
 * Dual-read shop_orders (legacy) + tenant_orders (v1.1) scope par tenant.
 * Reutilise les helpers PortalOrders.helpers.ts pour la normalisation et le
 * mapping des statuts (parite UI cote acheteur /shop/:slug et owner dashboard).
 *
 * Hors scope (S3.1 Phase 3 a venir) :
 *  - Filtres avances (statut, date, montant)
 *  - Tri colonne cliquable
 *  - Pagination > 100 commandes
 *  - Modale audit trail (tenant_order_status_events)
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShoppingBag } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useShops } from '../../contexts/ShopsContext';
import { applyTax, getTaxRate } from '../../utils/tax';
import {
  type OrderUI,
  type ShopOrderRow,
  type TenantOrderRow,
  STATUS_LABELS,
  mergeAndSortOrders,
  normalizeShopOrder,
  normalizeTenantOrder,
} from '../shop/portal/PortalOrders.helpers';

interface DashboardOrderUI extends OrderUI {
  shop_id: string;
}

function formatEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
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

      {loading && (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      )}

      {error && !loading && (
        <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          Erreur : {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune commande pour l instant.</p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Boutique</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Articles</th>
                <th className="px-3 py-2 text-right">Total HT</th>
                <th className="px-3 py-2 text-right">Total TTC</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => {
                const itemsCount = o.items.reduce((s, it) => s + (it.qty ?? 1), 0);
                const linesCount = o.items.length;
                const statusInfo = STATUS_LABELS[o.status] ?? {
                  label: o.status,
                  className: 'bg-gray-100 text-gray-700',
                };
                const shopSlug = shopSlugById.get(o.shop_id) ?? '—';
                const clientLabel =
                  o.source === 'legacy' ? o.customer_name || '—' : 'Acheteur tenant';

                return (
                  <tr key={o.id} className="hover:bg-gray-50" data-order-source={o.source}>
                    <td className="px-3 py-2 text-gray-600 text-xs font-mono">
                      {formatDate(o.date)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{shopSlug}</td>
                    <td className="px-3 py-2">{clientLabel}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">
                      {linesCount} ligne{linesCount > 1 ? 's' : ''} · {itemsCount} ex.
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatEuro(o.total_ht)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {formatEuro(o.total_ttc)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* S-DUAL-READ Sally H1-bis : marker discret cohort legacy */}
                        {o.source === 'legacy' && (
                          <>
                            <span
                              className="bg-gray-400 w-1.5 h-1.5 rounded-full shrink-0"
                              aria-hidden="true"
                              title="Commande antérieure au 17/05/2026 (modèle legacy)"
                            />
                            <span className="sr-only">Commande au format antérieur. </span>
                          </>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
