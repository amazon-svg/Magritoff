import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { OrdersApiClient } from '@/modules/orders';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type OrderUI,
  orderSummaryToUi,
} from '@/modules/orders/ui/storefront/PortalOrders.helpers';
import { formatCancelErrorMessage } from '@/modules/orders/ui/storefront/orderCancellation.helpers';
import { formatValidateErrorMessage } from '@/modules/orders/ui/storefront/orderValidation.helpers';
import { toRpcLikeError } from '@/modules/orders/ui/storefront/orderTransitionErrors.helpers';

export interface DashboardOrderUI extends OrderUI {
  shop_id: string;
}

export function dashboardOrderTransitionKey(
  orderId: string,
  fromStatus: string,
  toStatus: string,
): string {
  return `order-transition:${orderId}:${fromStatus}:${toStatus}`;
}

/**
 * Dépendances injectables de `runOrderTransition` — permet de tester
 * l'orchestration (transition puis rechargement, succes ET echec) sans
 * rendu React, avec des espions vitest (qa-review round 2, 2026-09-16,
 * mutations M4/M5). `reload` encapsule deja la garde de staleness
 * (targetKeyRef) : le hook lui passe une closure qui decide si le
 * rechargement s'applique encore.
 */
export interface RunOrderTransitionDeps {
  transition: () => Promise<unknown>;
  reload: () => Promise<void>;
  onError?: (err: unknown) => void;
}

/**
 * Orchestre une transition de commande (cancel/validate/start
 * production/mark shipped) : tente la transition, capture l'echec sans le
 * laisser remonter, puis recharge la liste dans les DEUX cas — succes ET
 * echec (fix BCP-5, recette 2026-09-15/16, CONVENTIONS §8.25 5.1(c)) : un
 * rejet ('transition_not_allowed', 'order_not_found', ...) signifie souvent
 * que le vrai statut a change ailleurs, la ligne doit le refleter meme si le
 * dialogue reste ouvert avec le message. Retourne la cause (non null) sur
 * echec, `null` sur succes.
 */
export async function runOrderTransition(deps: RunOrderTransitionDeps): Promise<unknown | null> {
  let cause: unknown = null;
  try {
    await deps.transition();
  } catch (err) {
    deps.onError?.(err);
    cause = err;
  }
  await deps.reload();
  return cause;
}

export function useDashboardOrderManagement({
  enabled,
  tenantId,
  shopIds,
}: {
  enabled: boolean;
  tenantId: string | null;
  shopIds: readonly string[];
}) {
  const ordersApi = useWorkspaceApi(OrdersApiClient);
  const shopScope = shopIds.join(',');
  const targetKey = `${enabled ? 'enabled' : 'disabled'}:${tenantId ?? ''}:${shopScope}`;
  const targetKeyRef = useRef<string | null>(targetKey);
  targetKeyRef.current = targetKey;
  const requestVersion = useRef(0);
  const [orders, setOrders] = useState<DashboardOrderUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!enabled || !tenantId || !shopScope) {
      setOrders([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await ordersApi.listTenantOrders(tenantId, shopScope.split(','));
      if (version === requestVersion.current) {
        setOrders(response.orders.map((order) => ({
          ...orderSummaryToUi(order),
          shop_id: order.shopId,
        })));
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        const message = cause instanceof Error
          ? cause.message
          : 'Chargement des commandes impossible.';
        console.warn('[DashboardOrders] API read failed:', message);
        setError(message);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [enabled, ordersApi, shopScope, tenantId]);

  useEffect(() => {
    void reload();
    return () => {
      requestVersion.current += 1;
      if (targetKeyRef.current === targetKey) targetKeyRef.current = null;
    };
  }, [reload, targetKey]);

  const transition = (
    order: Pick<OrderUI, 'id' | 'status'>,
    toStatus: 'cancelled' | 'validated' | 'in_production' | 'shipped',
    // Q17-c (docs/api/CONVENTIONS.md §8.25 point 12 (c)) — geste DISTINCT et
    // explicite, jamais une valeur par défaut silencieuse : porté par la
    // confirmation nommée de ValidateOrderConfirmDialog, jamais deviné ici.
    acknowledgeUnverifiedPrices = false,
  ): Promise<unknown | null> => {
    const operationTarget = targetKey;
    return runOrderTransition({
      transition: () => ordersApi.transition(order.id, {
        toStatus,
        reason: null,
        idempotencyKey: dashboardOrderTransitionKey(order.id, order.status, toStatus),
        acknowledgeUnverifiedPrices,
      }),
      reload: async () => {
        if (operationTarget === targetKeyRef.current) await reload();
      },
      onError: (err) => console.warn(`[DashboardOrders] transition ${order.status}→${toStatus} failed:`, err),
    });
  };

  const cancel = async (orderId: string): Promise<string | null> => {
    const order = orders.find((candidate) => candidate.id === orderId);
    const cause = await transition(order ?? { id: orderId, status: 'draft' }, 'cancelled');
    return cause === null
      ? null
      : formatCancelErrorMessage(toRpcLikeError(cause));
  };

  const validate = async (orderId: string, acknowledgeUnverifiedPrices = false): Promise<string | null> => {
    const order = orders.find((candidate) => candidate.id === orderId);
    const cause = await transition(order ?? { id: orderId, status: 'draft' }, 'validated', acknowledgeUnverifiedPrices);
    return cause === null
      ? null
      : formatValidateErrorMessage(toRpcLikeError(cause));
  };

  const startProduction = async (order: OrderUI) => {
    await transition(order, 'in_production');
  };

  const markShipped = async (order: OrderUI) => {
    await transition(order, 'shipped');
  };

  return {
    orders,
    loading,
    error,
    reload,
    cancel,
    validate,
    startProduction,
    markShipped,
    auditApi: ordersApi,
  } as const;
}
