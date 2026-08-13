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
import { OrdersApiClient } from "../../../../modules/orders";
import { useApiRuntimeClient } from "../../../contexts/ApiRuntimeContext";
import { useAuth } from "../../../contexts/AuthContext";
import { TEST_IDS } from "../../../lib/testIds";
import {
  type OrderUI,
  type PortalOrdersCounters,
  type PortalOrdersTab,
  type PortalOrdersTabVisibility,
  computeTabVisibility,
  orderSummaryToUi,
  TAB_EMPTY_STATES,
  TAB_FROM_QUERY,
  TAB_LABELS,
  TAB_QUERY_PARAM,
} from "./PortalOrders.helpers";
import { OrderHistoryTable } from "./OrderHistoryTable";
import { PortalOrderEditor } from "./PortalOrderEditor";
import { CancelOrderConfirmDialog } from "./CancelOrderConfirmDialog";
import { RejectOrderConfirmDialog } from "./RejectOrderConfirmDialog";
import { formatCancelErrorMessage } from "./orderCancellation.helpers";
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
  const apiClient = useApiRuntimeClient();

  const [activeTab, setActiveTabState] = useState<PortalOrdersTab>(readActiveTabFromUrl);
  const [datasets, setDatasets] = useState<DatasetsByTab>(EMPTY_DATASETS);
  const [counters, setCounters] = useState<PortalOrdersCounters>(ZERO_COUNTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ordersApi = useMemo(() => new OrdersApiClient(apiClient), [apiClient]);

  // S3.4 + S-ORDER-ROLES-3-UI : 2 modals de transition workflow
  const [orderToCancel, setOrderToCancel] = useState<OrderUI | null>(null);
  const [orderToReject, setOrderToReject] = useState<OrderUI | null>(null);
  // 2026-07-08 : commande draft en cours d'édition (auteur).
  const [orderToEdit, setOrderToEdit] = useState<OrderUI | null>(null);

  const setActiveTab = useCallback((tab: PortalOrdersTab) => {
    setActiveTabState(tab);
    syncActiveTabToUrl(tab);
  }, []);

  // ─── Chargement principal via la façade Orders API ───────────────────────
  const loadAll = useCallback(async () => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    // Anonyme (pas de session) : pas de query workflow possible (auth.uid()
    // null côté RPC SECURITY INVOKER). On clear le loading + on laisse les
    // datasets vides — le render affichera un empty state "Mes commandes"
    // avec CTA login implicite (cohérent avec UX existante pré-bascule).
    if (!user?.id) {
      setLoading(false);
      setDatasets(EMPTY_DATASETS);
      setCounters(ZERO_COUNTERS);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await ordersApi.listPortalOrders(shopId);
      setCounters(response.counters);
      setDatasets({
        mine: response.datasets.mine.map(orderSummaryToUi),
        to_validate: response.datasets.to_validate.map(orderSummaryToUi),
        to_approve: response.datasets.to_approve.map(orderSummaryToUi),
        to_produce: response.datasets.to_produce.map(orderSummaryToUi),
      });
    } catch (err) {
      console.warn("[PortalOrders] loadAll exception:", err);
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [shopId, user?.id, ordersApi]);

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
      try {
        await ordersApi.transition(order.id, {
          toStatus: toStatus as 'validated' | 'in_production' | 'shipped' | 'delivered' | 'invoiced' | 'cancelled',
          reason,
          idempotencyKey: `order-transition:${order.id}:${fromStatus}:${toStatus}`,
        });
      } catch (cause) {
        console.warn(`[PortalOrders] transition ${fromStatus}→${toStatus} failed:`, cause);
        return formatCancelErrorMessage(cause instanceof Error ? cause : null);
      }
      toast.success(successMsg);
      await loadAll();
      return null;
    },
    [ordersApi, loadAll],
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
    onEditOrder: (o: OrderUI) => void;
    onRenewOrder: (o: OrderUI) => void | Promise<void>;
    onValidateOrder: (o: OrderUI) => void | Promise<void>;
    onRejectOrder: (o: OrderUI) => void;
    onStartProductionOrder: (o: OrderUI) => void | Promise<void>;
    onMarkShippedOrder: (o: OrderUI) => void | Promise<void>;
  }>> = {
    mine: {
      onCancelOrder: (o) => setOrderToCancel(o),
      onEditOrder: (o) => setOrderToEdit(o),
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

      <PortalOrderEditor
        order={orderToEdit}
        onClose={() => setOrderToEdit(null)}
        onSaved={loadAll}
      />
    </div>
  );
}
