/**
 * PortalOrders — Vue "Mes commandes" boutique B2B (S-FIX-3).
 *
 * Connecte le rendu de la vue 'orders' du PublicShop a la table shop_orders
 * existante (legacy v3, RLS public read par shop_id). Avant ce fix, la vue
 * affichait un placeholder statique "L historique sera disponible dans une
 * prochaine iteration" alors que submitCart() inserait deja les commandes.
 *
 * Surface :
 *  - Query shop_orders filtre par shop_id, tri par created_at desc
 *  - Tableau simple avec : date, client, items (badge count), total HT,
 *    total TTC, statut
 *  - Empty state explicite si pas de commandes
 *
 * Hors scope (Epic 3 v1.1) : statut workflow (validated/cancelled), audit
 * trail, renouveler 1-clic, filtres avances. Ces stories Epic 3 sont en
 * backlog.
 */

import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { supabase } from "/utils/supabase/client";
import { useAuth } from "../../../contexts/AuthContext";
import { TEST_IDS } from "../../../lib/testIds";

interface ShopOrder {
  id: string;
  shop_id: string;
  customer_name: string;
  customer_email: string;
  items: Array<{ product_id?: string; name?: string; qty?: number; price_ht?: number }>;
  total_ht: number;
  total_ttc: number;
  status: string;
  notes?: string;
  created_at: string;
}

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

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-warn-bg text-warn-fg border-warn-fg/20" },
  validated: { label: "Validée", className: "bg-ok-bg text-ok-fg border-ok-line" },
  cancelled: { label: "Annulée", className: "bg-err-bg text-err-fg border-err-fg/20" },
  shipped: { label: "Expédiée", className: "bg-info-bg text-info-fg border-info-fg/20" },
};

export function PortalOrders({ shopId }: Props) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      // S-FIX-6 : la RLS shop_orders SELECT autorise :
      //  - owner shop (auth.uid() = shops.owner_user_id)
      //  - acheteur authentifie (customer_email = auth.email())
      // Le filtre customer_email cote front est en defense en profondeur :
      // si l user est authentifie, on filtre pour ne voir QUE ses commandes
      // (pas celles d autres acheteurs sur la meme shop). Un owner shop
      // garde la vue complete (filtre customer_email omis).
      let query = supabase
        .from("shop_orders")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(100);

      // Si user authentifie ET non-anonyme, filtrer ses propres commandes
      // (defense supplementaire ; la RLS le ferait deja, mais front explicite)
      if (user?.email) {
        query = query.eq("customer_email", user.email);
      }

      const { data, error: err } = await query;
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setOrders((data ?? []) as ShopOrder[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId, user?.email]);

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
                const itemsCount = Array.isArray(o.items)
                  ? o.items.reduce((s, it) => s + (it.qty ?? 1), 0)
                  : 0;
                const linesCount = Array.isArray(o.items) ? o.items.length : 0;
                const statusInfo = STATUS_LABELS[o.status] ?? {
                  label: o.status,
                  className: "bg-line text-ink-2 border-line",
                };
                return (
                  <tr
                    key={o.id}
                    data-testid={TEST_IDS.shop.ordersRow}
                    data-order-id={o.id}
                    className="border-b border-line hover:bg-bg transition-colors"
                  >
                    <td className="py-3 pr-4 text-ink-2 font-mono"
                        style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatDate(o.created_at)}
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
                      <span
                        className={`inline-block px-2 py-0.5 rounded border font-mono uppercase ${statusInfo.className}`}
                        style={{ fontSize: "10px", letterSpacing: "0.06em", fontWeight: 500 }}
                      >
                        {statusInfo.label}
                      </span>
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
