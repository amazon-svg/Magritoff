import { useCallback, useEffect, useRef, useState } from 'react';
import { OrdersApiClient, type OrderListEntry, type OrderListFilters } from '@/modules/orders';
import { CommercialOrdersApiClient } from '@/modules/commercial-orders';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { ProductionStepsApiClient, type ProductionStepDto } from '@/modules/production-steps';
import type { OrderUI } from '../storefront/PortalOrders.helpers';

export function orderListEntryToUi(order: OrderListEntry): OrderUI & { shop_name: string | null } {
  return {
    id: order.id, number: order.number, customer_id: order.customer_id,
    source: order.origin === 'quote' ? 'commercial' : 'v1_1',
    date: order.created_at, customer_name: order.customer_name ?? 'Client',
    customer_email: order.customer_email ?? '',
    items: order.items.map((item) => ({ name: item.name, qty: item.quantity, price_ht: Number(item.unit_price_ht), priceOrigin: item.price_origin })),
    total_ht: Number(order.total_ht), total_ttc: Number(order.total_ttc),
    status: order.status, hasUnverifiedPrices: order.has_unverified_prices,
    currentProductionStepId: order.current_production_step_id,
    shop_name: order.shop_name,
  };
}

/** Une page par requête ; une nouvelle sélection invalide les réponses précédentes. */
export function useUnifiedOrders(tenantId: string | null, enabled: boolean) {
  const api = useWorkspaceApi(OrdersApiClient);
  const commercialOrdersApi = useWorkspaceApi(CommercialOrdersApiClient);
  const stepsApi = useWorkspaceApi(ProductionStepsApiClient);
  const [steps, setSteps] = useState<readonly ProductionStepDto[]>([]);
  const [stepsError, setStepsError] = useState(false);
  useEffect(() => {
    let active = true;
    setSteps([]); setStepsError(false);
    if (enabled && tenantId) {
      void stepsApi.list().then((response) => {
        if (active) setSteps(response.data);
      }).catch(() => { if (active) setStepsError(true); });
    }
    return () => { active = false; };
  }, [stepsApi, tenantId, enabled]);
  const [selection, setSelection] = useState<{ filters: OrderListFilters; cursors: (string | undefined)[] }>({
    filters: {}, cursors: [undefined],
  });
  const [result, setResult] = useState<{ items: OrderListEntry[]; nextCursor: string | null }>({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const version = useRef(0);
  const scope = useRef(tenantId);
  const pageCursor = selection.cursors.at(-1);

  useEffect(() => {
    if (scope.current !== tenantId) {
      scope.current = tenantId;
      setSelection({ filters: {}, cursors: [undefined] });
      setResult({ items: [], nextCursor: null });
      return;
    }
    const requestVersion = ++version.current;
    setResult({ items: [], nextCursor: null });
    setError(null);
    if (!enabled || !tenantId) { setLoading(false); return; }
    setLoading(true);
    void api.list({ ...selection.filters, pageSize: 50, ...(pageCursor ? { pageCursor } : {}) })
      .then((response) => { if (requestVersion === version.current) setResult(response); })
      .catch((cause: unknown) => {
        if (requestVersion === version.current) setError(cause instanceof Error ? cause.message : 'Chargement des commandes impossible.');
      })
      .finally(() => { if (requestVersion === version.current) setLoading(false); });
    return () => { version.current += 1; };
  }, [api, enabled, tenantId, selection, pageCursor, revision]);

  const applyFilters = useCallback((filters: OrderListFilters) => setSelection({ filters, cursors: [undefined] }), []);
  return {
    orders: result.items.map(orderListEntryToUi), loading, error, auditApi: api, steps, stepsError,
    page: selection.cursors.length, hasNext: result.nextCursor !== null,
    applyFilters, activeFilters: selection.filters,
    validateOrder: (order: Pick<OrderUI, 'id' | 'hasUnverifiedPrices'>) => api.transition(order.id, {
      toStatus: 'validated',
      reason: null,
      idempotencyKey: `orders-bulk-validation:${order.id}:${crypto.randomUUID()}`,
      acknowledgeUnverifiedPrices: order.hasUnverifiedPrices === true,
    }),
    changeProductionStep: (orderId: string, stepId: string) => commercialOrdersApi.changeProductionStep(orderId, { step_id: stepId }),
    reload: () => setRevision((value) => value + 1),
    next: () => {
      if (loading || !result.nextCursor) return;
      const cursor = result.nextCursor;
      setSelection((current) => ({ ...current, cursors: [...current.cursors, cursor] }));
    },
    previous: () => setSelection((current) => current.cursors.length > 1
      ? { ...current, cursors: current.cursors.slice(0, -1) } : current),
  };
}
