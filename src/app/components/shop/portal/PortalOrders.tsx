/**
 * PortalOrders — Vue "Mes commandes" boutique B2B.
 *
 * S-DUAL-READ (Sprint 4 Phase 1, 2026-05-18, ADR-ORDERS-1 §4.10) :
 * Dual-read UNION shop_orders (legacy) + tenant_orders (v1.1 post-bascule).
 *
 * S3.1 (Sprint 5, 2026-05-23) : refactor pour deleguer le rendu table +
 * filtres + tri au composant <OrderHistoryTable>. Ce wrapper ne fait plus
 * que data-fetching (2 queries + normalisation OrderUI) et passe les orders
 * au composant pur.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "/utils/supabase/client";
import { useAuth } from "../../../contexts/AuthContext";
import { useTenant } from "../../../contexts/TenantContext";
import { applyTax, getTaxRate } from "../../../utils/tax";
import { TEST_IDS } from "../../../lib/testIds";
import {
  type OrderUI,
  type ShopOrderRow,
  type TenantOrderRow,
  mergeAndSortOrders,
  normalizeShopOrder,
  normalizeTenantOrder,
} from "./PortalOrders.helpers";
import { OrderHistoryTable } from "./OrderHistoryTable";
import { CancelOrderConfirmDialog } from "./CancelOrderConfirmDialog";
import { formatCancelErrorMessage } from "./orderCancellation.helpers";

interface Props {
  shopId: string;
  /**
   * S3.3 (Sprint 5) : callback Renouveler 1-clic remonté depuis PublicShop.
   * Si fourni, OrderHistoryTable affiche le bouton "Renouveler" sur les
   * lignes éligibles (v1.1 + status workflow/terminal).
   */
  onRenewOrder?: (order: OrderUI) => void | Promise<void>;
}

export function PortalOrders({ shopId, onRenewOrder }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [orders, setOrders] = useState<OrderUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // S3.4 : modal annulation. orderToCancel = null → modal fermé.
  const [orderToCancel, setOrderToCancel] = useState<OrderUI | null>(null);

  const loadOrders = useCallback(async (cancelled: { current: boolean }) => {
    if (!shopId) return;
    setLoading(true);
    setError(null);

    // R0 : taxRate du tenant courant pour calculer total_ttc des
    // tenant_orders v1.1 qui ne stockent que total_ht + currency.
    const taxRate = getTaxRate(currentTenant);
    const taxedTotal = (ht: number) => applyTax(ht, taxRate);

    // ── Query A : shop_orders legacy (cohort figee) ──────────────────────
    let queryA = supabase
      .from("shop_orders")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (user?.email) {
      queryA = queryA.eq("customer_email", user.email);
    }

    // ── Query B : tenant_orders v1.1 (cohort post-bascule) ───────────────
    let queryB = supabase
      .from("tenant_orders")
      .select(
        "id, shop_id, tenant_id, created_by, status, total_ht, currency, notes, created_at, tenant_order_items(product_label, quantity, unit_price_ht, line_total_ht)",
      )
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (user?.id) {
      queryB = queryB.eq("created_by", user.id);
    }

    const [resA, resB] = await Promise.all([queryA, queryB]);

    if (cancelled.current) return;

    const legacyOrders: OrderUI[] = [];
    const v11Orders: OrderUI[] = [];

    if (resA.error) {
      console.warn("[PortalOrders] query shop_orders failed:", resA.error.message);
    } else if (Array.isArray(resA.data)) {
      for (const row of resA.data as ShopOrderRow[]) {
        legacyOrders.push(normalizeShopOrder(row));
      }
    }

    if (resB.error) {
      console.warn("[PortalOrders] query tenant_orders failed:", resB.error.message);
    } else if (Array.isArray(resB.data)) {
      for (const row of resB.data as TenantOrderRow[]) {
        v11Orders.push(normalizeTenantOrder(row, taxedTotal));
      }
    }

    if (resA.error && resB.error) {
      setError(`${resA.error.message} / ${resB.error.message}`);
      setLoading(false);
      return;
    }

    setOrders(mergeAndSortOrders(legacyOrders, v11Orders));
    setLoading(false);
  }, [shopId, user?.email, user?.id, currentTenant]);

  useEffect(() => {
    const cancelled = { current: false };
    void loadOrders(cancelled);
    return () => {
      cancelled.current = true;
    };
  }, [loadOrders]);

  // S3.4 : handler ouverture modal + handler confirm RPC.
  const handleCancelOrderRequest = (order: OrderUI) => {
    setOrderToCancel(order);
  };

  const handleCancelConfirm = async (orderId: string): Promise<string | null> => {
    const { error: rpcErr } = await supabase.rpc('update_tenant_order_status', {
      p_order_id: orderId,
      p_new_status: 'cancelled',
      p_reason: null,
    });
    if (rpcErr) {
      console.warn('[PortalOrders] cancel RPC failed:', rpcErr.message);
      return formatCancelErrorMessage(rpcErr);
    }
    // Succès : refresh la liste pour refléter le nouveau statut.
    await loadOrders({ current: false });
    return null;
  };

  return (
    <div
      data-testid={TEST_IDS.shop.ordersList}
      className="max-w-5xl mx-auto px-9 py-12"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      <h2
        className="text-ink m-0 mb-2"
        style={{ fontSize: "28px", fontWeight: 300, letterSpacing: "-0.025em" }}
      >
        Mes commandes
      </h2>
      <p
        className="text-ink-muted m-0 mb-8"
        style={{ fontSize: "13.5px", fontWeight: 400 }}
      >
        Historique des commandes passées dans cette boutique.
      </p>

      <OrderHistoryTable
        orders={orders}
        loading={loading}
        error={error}
        persistKey={`orderHistory:shop:${shopId}`}
        onRenewOrder={onRenewOrder}
        onCancelOrder={handleCancelOrderRequest}
      />

      <CancelOrderConfirmDialog
        orderId={orderToCancel?.id ?? null}
        orderShortId={
          orderToCancel?.id ? orderToCancel.id.replace(/-/g, '').slice(0, 8).toUpperCase() : undefined
        }
        onConfirm={handleCancelConfirm}
        onClose={() => setOrderToCancel(null)}
      />
    </div>
  );
}
