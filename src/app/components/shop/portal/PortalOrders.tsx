/**
 * PortalOrders — Vue commandes boutique B2B refondue en 4 tabs filtrés
 * par rôle workflow (Story S-ORDER-ROLES-3-UI Sprint 6+, wireframes Sally
 * 2026-06-08).
 *
 * Tabs :
 *  - "Mes commandes"   : créateur OU rôle Acheteur (toujours visible)
 *  - "À valider"       : draft + can_validate intermédiaire (masqué si 0)
 *  - "À approuver"     : draft + can_validate final ordering_index=MAX (masqué si 0)
 *  - "À produire"      : (validated, in_production) + rôle Producteur (masqué si 0)
 *
 * Architecture :
 *  - Compteurs badges : 1 round-trip via RPC get_portal_orders_counters
 *  - IDs par tab      : 1 round-trip via RPC get_portal_orders_workflow
 *  - Données complètes: 1 round-trip Supabase select sur tenant_orders/items
 *  - Cohort legacy shop_orders dual-read conservé MAIS UNIQUEMENT dans
 *    le tab "Mes commandes" (les workflow tabs sont v1.1 exclusifs).
 *
 * Cohérence DashboardOrders (lesson 2026-05-25 §refonte non-cassante) :
 *  - Les boutons d'action role-driven (Valider/Refuser/StartProd/Shipped)
 *    sont les mêmes côté admin tenant DashboardOrders et côté acheteur
 *    PortalOrders. Pas 2 systèmes côte à côte.
 *  - Le composant <OrderHistoryTable> expose les callbacks correspondants
 *    et le parent (PortalOrders ou DashboardOrders) les fournit selon
 *    les capabilities du user.
 *
 * S3.5 wire-up (commit f49926b) : bouton Historique audit trail conservé
 * sur chaque ligne v1.1 (toutes les commandes pas seulement la cohorte
 * acheteur primaire).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "/utils/supabase/client";
import { useAuth } from "../../../contexts/AuthContext";
import { useTenant } from "../../../contexts/TenantContext";
import { applyTax, getTaxRate } from "../../../utils/tax";
import { TEST_IDS } from "../../../lib/testIds";
import {
  type OrderUI,
  type PortalOrdersCounters,
  type PortalOrdersTab,
  type PortalOrdersTabVisibility,
  type ShopOrderRow,
  type TenantOrderRow,
  computeTabVisibility,
  mergeAndSortOrders,
  normalizeShopOrder,
  normalizeTenantOrder,
  TAB_EMPTY_STATES,
  TAB_FROM_QUERY,
  TAB_LABELS,
  TAB_QUERY_PARAM,
} from "./PortalOrders.helpers";
import { OrderHistoryTable } from "./OrderHistoryTable";
import { CancelOrderConfirmDialog } from "./CancelOrderConfirmDialog";
import { RejectOrderConfirmDialog } from "./RejectOrderConfirmDialog";
import { formatCancelErrorMessage } from "./orderCancellation.helpers";
import { triggerOrderWorkflowStep } from "./orderWorkflowStep.helpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";

interface Props {
  shopId: string;
  /**
   * S3.3 (Sprint 5) : callback Renouveler 1-clic remonté depuis PublicShop.
   * Si fourni, OrderHistoryTable affiche le bouton "Renouveler" sur les
   * lignes éligibles (v1.1 + status workflow/terminal).
   */
  onRenewOrder?: (order: OrderUI) => void | Promise<void>;
  /**
   * S-ORDER-ROLES-3-UI : callback navigation vers catalogue (CTA empty state
   * tab "Mes commandes"). Si non fourni, l'empty state masque le CTA.
   */
  onNavigateToCatalog?: () => void;
}

type DatasetsByTab = Record<PortalOrdersTab, OrderUI[]>;

const EMPTY_DATASETS: DatasetsByTab = {
  mine: [],
  to_validate: [],
  to_approve: [],
  to_produce: [],
};

const ZERO_COUNTERS: PortalOrdersCounters = {
  mine: 0,
  to_validate: 0,
  to_approve: 0,
  to_produce: 0,
};

/** Détermine le tab initial depuis ?tab=... dans l'URL. */
function readActiveTabFromUrl(): PortalOrdersTab {
  if (typeof window === "undefined") return "mine";
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("tab");
    if (raw && TAB_FROM_QUERY[raw]) return TAB_FROM_QUERY[raw];
  } catch {
    // URL invalide → fallback mine
  }
  return "mine";
}

function syncActiveTabToUrl(tab: PortalOrdersTab) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", TAB_QUERY_PARAM[tab]);
    window.history.replaceState({}, "", url);
  } catch {
    // localStorage / history bloqués → silent
  }
}

export function PortalOrders({ shopId, onRenewOrder, onNavigateToCatalog }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [activeTab, setActiveTabState] = useState<PortalOrdersTab>(readActiveTabFromUrl);
  const [datasets, setDatasets] = useState<DatasetsByTab>(EMPTY_DATASETS);
  const [counters, setCounters] = useState<PortalOrdersCounters>(ZERO_COUNTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // S3.4 + S-ORDER-ROLES-3-UI : 2 modals de transition workflow
  const [orderToCancel, setOrderToCancel] = useState<OrderUI | null>(null);
  const [orderToReject, setOrderToReject] = useState<OrderUI | null>(null);

  const setActiveTab = useCallback((tab: PortalOrdersTab) => {
    setActiveTabState(tab);
    syncActiveTabToUrl(tab);
  }, []);

  // ─── Chargement principal : 5 round-trips parallèles ──────────────────────
  //   1× RPC counters → badges + visibility
  //   4× RPC workflow IDs + fetch tenant_orders détails par tab
  //   (mine inclut aussi la cohorte legacy shop_orders dual-read)
  const loadAll = useCallback(async () => {
    if (!shopId || !user?.id) return;
    setLoading(true);
    setError(null);

    const taxRate = getTaxRate(currentTenant);
    const taxedTotal = (ht: number) => applyTax(ht, taxRate);

    try {
      // 1. Compteurs (parallèle)
      const countersPromise = supabase.rpc("get_portal_orders_counters", {
        p_shop_id: shopId,
        p_user_id: user.id,
      });

      // 2. IDs par tab (4 RPC parallèles)
      const idsPromises = (
        ["mine", "to_validate", "to_approve", "to_produce"] as PortalOrdersTab[]
      ).map((tab) =>
        supabase.rpc("get_portal_orders_workflow", {
          p_shop_id: shopId,
          p_tab: tab,
          p_user_id: user.id,
        }),
      );

      // 3. Cohort legacy shop_orders pour le tab "mine" uniquement
      let legacyQuery = supabase
        .from("shop_orders")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (user?.email) {
        legacyQuery = legacyQuery.eq("customer_email", user.email);
      }

      const [countersRes, mineIdsRes, toValidateIdsRes, toApproveIdsRes, toProduceIdsRes, legacyRes] =
        await Promise.all([countersPromise, ...idsPromises, legacyQuery]);

      // Compteurs (fallback safe si erreur)
      if (countersRes.error) {
        console.warn("[PortalOrders] counters RPC failed:", countersRes.error.message);
      } else if (Array.isArray(countersRes.data) && countersRes.data.length > 0) {
        const row = countersRes.data[0] as PortalOrdersCounters;
        setCounters({
          mine: row.mine ?? 0,
          to_validate: row.to_validate ?? 0,
          to_approve: row.to_approve ?? 0,
          to_produce: row.to_produce ?? 0,
        });
      }

      // Helper : extrait les UUIDs depuis le résultat RPC
      const extractIds = (res: { data: unknown }): string[] => {
        if (!Array.isArray(res.data)) return [];
        return res.data
          .map((r) => (r as { order_id?: string }).order_id)
          .filter((id): id is string => typeof id === "string");
      };

      const mineIds = extractIds(mineIdsRes);
      const toValidateIds = extractIds(toValidateIdsRes);
      const toApproveIds = extractIds(toApproveIdsRes);
      const toProduceIds = extractIds(toProduceIdsRes);
      const allTenantOrderIds = Array.from(
        new Set([...mineIds, ...toValidateIds, ...toApproveIds, ...toProduceIds]),
      );

      // 4. Fetch tenant_orders détails pour TOUS les IDs concernés (1 round-trip)
      const ordersById = new Map<string, OrderUI>();
      if (allTenantOrderIds.length > 0) {
        const detailsRes = await supabase
          .from("tenant_orders")
          .select(
            "id, shop_id, tenant_id, created_by, status, total_ht, currency, notes, created_at, tenant_order_items(product_label, quantity, unit_price_ht, line_total_ht)",
          )
          .in("id", allTenantOrderIds);
        if (detailsRes.error) {
          console.warn("[PortalOrders] tenant_orders fetch failed:", detailsRes.error.message);
        } else if (Array.isArray(detailsRes.data)) {
          for (const row of detailsRes.data as TenantOrderRow[]) {
            ordersById.set(row.id, normalizeTenantOrder(row, taxedTotal));
          }
        }
      }

      // 5. Legacy → uniquement dans "mine"
      const legacyOrders: OrderUI[] = [];
      if (legacyRes.error) {
        console.warn("[PortalOrders] shop_orders legacy fetch failed:", legacyRes.error.message);
      } else if (Array.isArray(legacyRes.data)) {
        for (const row of legacyRes.data as ShopOrderRow[]) {
          legacyOrders.push(normalizeShopOrder(row));
        }
      }

      // 6. Reconstitue les 4 datasets
      const lookup = (ids: string[]): OrderUI[] =>
        ids.map((id) => ordersById.get(id)).filter((o): o is OrderUI => !!o);

      const mineV11 = lookup(mineIds);
      setDatasets({
        mine: mergeAndSortOrders(legacyOrders, mineV11),
        to_validate: lookup(toValidateIds),
        to_approve: lookup(toApproveIds),
        to_produce: lookup(toProduceIds),
      });
    } catch (err) {
      console.warn("[PortalOrders] loadAll exception:", err);
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [shopId, user?.id, user?.email, currentTenant]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ─── Handlers actions workflow ───────────────────────────────────────────

  const transitionStatus = useCallback(
    async (
      order: OrderUI,
      toStatus: string,
      reason: string | null,
      successMsg: string,
    ): Promise<string | null> => {
      const fromStatus = order.status;
      const { error: rpcErr } = await supabase.rpc("update_tenant_order_status", {
        p_order_id: order.id,
        p_new_status: toStatus,
        p_reason: reason,
      });
      if (rpcErr) {
        console.warn(`[PortalOrders] transition ${fromStatus}→${toStatus} failed:`, rpcErr.message);
        return formatCancelErrorMessage(rpcErr);
      }
      // S-N1-APPROVAL : déclenche notifications Resend (fire-and-forget)
      if (user?.id) {
        triggerOrderWorkflowStep({
          orderId: order.id,
          fromStatus,
          toStatus,
          actorUserId: user.id,
        });
      }
      toast.success(successMsg);
      await loadAll();
      return null;
    },
    [user?.id, loadAll],
  );

  const handleCancelConfirm = useCallback(
    async (orderId: string): Promise<string | null> => {
      const order = datasets.mine.find((o) => o.id === orderId)
        ?? datasets.to_validate.find((o) => o.id === orderId)
        ?? datasets.to_approve.find((o) => o.id === orderId)
        ?? datasets.to_produce.find((o) => o.id === orderId);
      if (!order) return "Commande introuvable";
      return transitionStatus(order, "cancelled", null, "Commande annulée.");
    },
    [datasets, transitionStatus],
  );

  const handleRejectConfirm = useCallback(
    async (orderId: string, reason: string): Promise<string | null> => {
      const order = datasets.to_validate.find((o) => o.id === orderId)
        ?? datasets.to_approve.find((o) => o.id === orderId);
      if (!order) return "Commande introuvable";
      return transitionStatus(
        order,
        "cancelled",
        reason,
        "Commande refusée. L'auteur a été prévenu.",
      );
    },
    [datasets, transitionStatus],
  );

  const handleValidate = useCallback(
    async (order: OrderUI) => {
      await transitionStatus(order, "validated", null, "Commande validée. L'étape suivante a été prévenue.");
    },
    [transitionStatus],
  );

  const handleStartProduction = useCallback(
    async (order: OrderUI) => {
      await transitionStatus(order, "in_production", null, "Production démarrée. L'acheteur a été prévenu.");
    },
    [transitionStatus],
  );

  const handleMarkShipped = useCallback(
    async (order: OrderUI) => {
      await transitionStatus(order, "shipped", null, "Commande expédiée. Acheteur et admin prévenus.");
    },
    [transitionStatus],
  );

  // ─── Visibility tabs + rendering ─────────────────────────────────────────

  const visibility: PortalOrdersTabVisibility = useMemo(
    () => computeTabVisibility(counters),
    [counters],
  );

  // Si le tab actif n'est plus visible (compteur passé à 0 post-action),
  // bascule sur "mine" qui est toujours visible.
  useEffect(() => {
    if (activeTab !== "mine" && !visibility[activeTab]) {
      setActiveTab("mine");
    }
  }, [activeTab, visibility, setActiveTab]);

  function renderBadge(count: number) {
    if (count === 0) return null;
    return (
      <span
        data-testid={TEST_IDS.shop.ordersTabBadgeCount}
        aria-label={`${count} commande${count > 1 ? "s" : ""}`}
        className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-ink/10 text-ink font-mono"
        style={{ fontSize: "10.5px", fontVariantNumeric: "tabular-nums" }}
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  function renderEmptyState(tab: PortalOrdersTab) {
    const meta = TAB_EMPTY_STATES[tab];
    const icon = tab === "mine" ? "🛒" : tab === "to_produce" ? "🛠" : "✓";
    return (
      <div
        data-testid={TEST_IDS.shop.ordersEmptyState}
        data-tab={tab}
        className="text-center py-16"
      >
        <div aria-hidden="true" style={{ fontSize: "32px", marginBottom: "12px" }}>
          {icon}
        </div>
        <h3 className="text-ink m-0 mb-2" style={{ fontSize: "16px", fontWeight: 500 }}>
          {meta.title}
        </h3>
        <p
          className="text-ink-muted m-0 mx-auto"
          style={{ fontSize: "13.5px", lineHeight: 1.55, maxWidth: "420px" }}
        >
          {meta.body}
        </p>
        {meta.ctaLabel && onNavigateToCatalog && tab === "mine" && (
          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-line bg-paper text-ink-muted hover:text-ink hover:border-ink-mute-2 transition-colors"
            style={{ fontSize: "13px" }}
          >
            {meta.ctaLabel} →
          </button>
        )}
      </div>
    );
  }

  // Callbacks par tab (cohérence inter-écrans, lesson 2026-05-25)
  const handlersByTab: Record<PortalOrdersTab, Partial<{
    onCancelOrder: (o: OrderUI) => void;
    onRenewOrder: (o: OrderUI) => void | Promise<void>;
    onValidateOrder: (o: OrderUI) => void | Promise<void>;
    onRejectOrder: (o: OrderUI) => void;
    onStartProductionOrder: (o: OrderUI) => void | Promise<void>;
    onMarkShippedOrder: (o: OrderUI) => void | Promise<void>;
  }>> = {
    mine: {
      onCancelOrder: (o) => setOrderToCancel(o),
      onRenewOrder,
    },
    to_validate: {
      onValidateOrder: handleValidate,
      onRejectOrder: (o) => setOrderToReject(o),
    },
    to_approve: {
      onValidateOrder: handleValidate,
      onRejectOrder: (o) => setOrderToReject(o),
    },
    to_produce: {
      onStartProductionOrder: handleStartProduction,
      onMarkShippedOrder: handleMarkShipped,
    },
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
        Toutes les commandes liées à votre activité dans cette boutique.
      </p>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as PortalOrdersTab)}
        className="gap-6"
      >
        <TabsList
          data-testid={TEST_IDS.shop.ordersTabs}
          className="w-full h-auto bg-transparent border-b border-line rounded-none p-0 justify-start gap-0"
        >
          <TabsTrigger
            value="mine"
            data-testid={TEST_IDS.shop.ordersTabMine}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-ink data-[state=active]:bg-transparent px-4 py-2.5"
          >
            {TAB_LABELS.mine}
            {renderBadge(counters.mine)}
          </TabsTrigger>
          {visibility.to_validate && (
            <TabsTrigger
              value="to_validate"
              data-testid={TEST_IDS.shop.ordersTabToValidate}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-ink data-[state=active]:bg-transparent px-4 py-2.5"
            >
              {TAB_LABELS.to_validate}
              {renderBadge(counters.to_validate)}
            </TabsTrigger>
          )}
          {visibility.to_approve && (
            <TabsTrigger
              value="to_approve"
              data-testid={TEST_IDS.shop.ordersTabToApprove}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-ink data-[state=active]:bg-transparent px-4 py-2.5"
            >
              {TAB_LABELS.to_approve}
              {renderBadge(counters.to_approve)}
            </TabsTrigger>
          )}
          {visibility.to_produce && (
            <TabsTrigger
              value="to_produce"
              data-testid={TEST_IDS.shop.ordersTabToProduce}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-ink data-[state=active]:bg-transparent px-4 py-2.5"
            >
              {TAB_LABELS.to_produce}
              {renderBadge(counters.to_produce)}
            </TabsTrigger>
          )}
        </TabsList>

        {(["mine", "to_validate", "to_approve", "to_produce"] as PortalOrdersTab[]).map(
          (tab) => (
            <TabsContent key={tab} value={tab} className="mt-0">
              {datasets[tab].length === 0 && !loading
                ? renderEmptyState(tab)
                : (
                  <OrderHistoryTable
                    orders={datasets[tab]}
                    loading={loading}
                    error={error}
                    persistKey={`orderHistory:shop:${shopId}:${tab}`}
                    {...handlersByTab[tab]}
                  />
                )}
            </TabsContent>
          ),
        )}
      </Tabs>

      <CancelOrderConfirmDialog
        orderId={orderToCancel?.id ?? null}
        orderShortId={
          orderToCancel?.id ? orderToCancel.id.replace(/-/g, "").slice(0, 8).toUpperCase() : undefined
        }
        onConfirm={handleCancelConfirm}
        onClose={() => setOrderToCancel(null)}
      />

      <RejectOrderConfirmDialog
        orderId={orderToReject?.id ?? null}
        orderShortId={
          orderToReject?.id ? orderToReject.id.replace(/-/g, "").slice(0, 8).toUpperCase() : undefined
        }
        onConfirm={handleRejectConfirm}
        onClose={() => setOrderToReject(null)}
      />
    </div>
  );
}
