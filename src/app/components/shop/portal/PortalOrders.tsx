/**
 * PortalOrders — Vue "Mes commandes" boutique B2B.
 *
 * S-DUAL-READ (Sprint 4 Phase 1, 2026-05-18, ADR-ORDERS-1 §4.10) :
 * Dual-read UNION shop_orders (legacy) + tenant_orders (v1.1 post-bascule
 * S-MIGRATION-ORDERS). Marker visuel discret sur les commandes legacy
 * (design Sally H1-bis : point gris + sr-only + title fallback desktop).
 *
 * Surface :
 *  - 2 queries Supabase parallelles (Promise.all)
 *  - Normalisation vers OrderUI commun (PortalOrders.helpers.ts)
 *  - Mapping 11 statuts (shop_orders + tenant_orders) vers labels UI
 *  - Empty state + loading + error + resilience 1 query fail
 *
 * Hors scope (S3.1+ a venir) : filtres avances, pagination, modale audit
 * trail (tenant_order_status_events).
 */

import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { supabase } from "/utils/supabase/client";
import { useAuth } from "../../../contexts/AuthContext";
import { useTenant } from "../../../contexts/TenantContext";
import { applyTax, getTaxRate } from "../../../utils/tax";
import { TEST_IDS } from "../../../lib/testIds";
import {
  type OrderUI,
  type ShopOrderRow,
  type TenantOrderRow,
  STATUS_LABELS,
  mergeAndSortOrders,
  normalizeShopOrder,
  normalizeTenantOrder,
} from "./PortalOrders.helpers";

interface Props {
  shopId: string;
}

function formatEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PortalOrders({ shopId }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [orders, setOrders] = useState<OrderUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      // R0 : taxRate du tenant courant pour calculer total_ttc des
      // tenant_orders v1.1 qui ne stockent que total_ht + currency.
      const taxRate = getTaxRate(currentTenant);
      const taxedTotal = (ht: number) => applyTax(ht, taxRate);

      // ── Query A : shop_orders legacy (cohort figee) ──────────────────────
      // RLS : owner_user_id (admin tenant) OU customer_email = auth.email().
      // Filtre customer_email en defense en profondeur.
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
      // RLS tenant_orders_select : current_user_can_access_shop(shop_id)
      // OU is_super_admin(). Join inner tenant_order_items pour items.
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

      // Promise.all : 2 queries en parallele. Resilience : si une query
      // echoue, l autre continue (cf. AC5 S-DUAL-READ).
      const [resA, resB] = await Promise.all([queryA, queryB]);

      if (cancelled) return;

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

      // Si les 2 queries echouent ensemble, on affiche une erreur explicite.
      if (resA.error && resB.error) {
        setError(`${resA.error.message} / ${resB.error.message}`);
        setLoading(false);
        return;
      }

      setOrders(mergeAndSortOrders(legacyOrders, v11Orders));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [shopId, user?.email, user?.id, currentTenant]);

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

      {loading && (
        <div className="flex items-center gap-2 text-ink-muted">
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          <span style={{ fontSize: "13px" }}>Chargement…</span>
        </div>
      )}

      {error && !loading && (
        <div
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-err-bg border border-err-fg/20 text-err-fg"
          style={{ fontSize: "13px", fontWeight: 400 }}
        >
          Erreur : {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="text-center py-16">
          <Package
            className="w-10 h-10 text-ink-mute-2 mx-auto mb-3"
            strokeWidth={1.2}
          />
          <p
            className="text-ink-muted m-0"
            style={{ fontSize: "14px", lineHeight: 1.55 }}
          >
            Vous n&apos;avez pas encore de commande dans cette boutique.
          </p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ fontSize: "13px" }}>
            <thead>
              <tr className="border-b border-line">
                <th className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2"
                    style={{ fontSize: "10.5px", letterSpacing: "0.08em", fontWeight: 500 }}>
                  Date
                </th>
                <th className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2"
                    style={{ fontSize: "10.5px", letterSpacing: "0.08em", fontWeight: 500 }}>
                  Client
                </th>
                <th className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2"
                    style={{ fontSize: "10.5px", letterSpacing: "0.08em", fontWeight: 500 }}>
                  Articles
                </th>
                <th className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2 text-right"
                    style={{ fontSize: "10.5px", letterSpacing: "0.08em", fontWeight: 500 }}>
                  Total HT
                </th>
                <th className="py-2.5 pr-4 font-mono uppercase text-ink-mute-2 text-right"
                    style={{ fontSize: "10.5px", letterSpacing: "0.08em", fontWeight: 500 }}>
                  Total TTC
                </th>
                <th className="py-2.5 font-mono uppercase text-ink-mute-2"
                    style={{ fontSize: "10.5px", letterSpacing: "0.08em", fontWeight: 500 }}>
                  Statut
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const itemsCount = o.items.reduce((s, it) => s + (it.qty ?? 1), 0);
                const linesCount = o.items.length;
                const statusInfo = STATUS_LABELS[o.status] ?? {
                  label: o.status,
                  className: "bg-line text-ink-2 border-line",
                };
                return (
                  <tr
                    key={o.id}
                    data-testid={TEST_IDS.shop.ordersRow}
                    data-order-id={o.id}
                    data-order-source={o.source}
                    className="border-b border-line hover:bg-bg transition-colors"
                  >
                    <td className="py-3 pr-4 text-ink-2 font-mono"
                        style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatDate(o.date)}
                    </td>
                    <td className="py-3 pr-4 text-ink">{o.customer_name || "—"}</td>
                    <td className="py-3 pr-4 text-ink-muted">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-line bg-paper text-ink-2"
                        style={{ fontSize: "11.5px" }}
                      >
                        {linesCount} ligne{linesCount > 1 ? "s" : ""} · {itemsCount} ex.
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-ink font-mono text-right"
                        style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatEuro(o.total_ht)}
                    </td>
                    <td className="py-3 pr-4 text-ink font-mono text-right font-medium"
                        style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatEuro(o.total_ttc)}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {/* S-DUAL-READ Sally H1-bis : marker discret cohort legacy */}
                        {o.source === 'legacy' && (
                          <>
                            <span
                              className="bg-ink-mute-2 w-1.5 h-1.5 rounded-full shrink-0"
                              aria-hidden="true"
                              title="Commande antérieure au 17/05/2026 (modèle legacy)"
                              data-testid={TEST_IDS.shop.ordersRowLegacyMarker}
                            />
                            <span className="sr-only">Commande au format antérieur. </span>
                          </>
                        )}
                        <span
                          className={`inline-block px-2 py-0.5 rounded border font-mono uppercase ${statusInfo.className}`}
                          style={{ fontSize: "10px", letterSpacing: "0.06em", fontWeight: 500 }}
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
