import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { OrdersApiClient } from '@/modules/orders';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type OrderUI,
  orderSummaryToUi,
} from '@/modules/orders/ui/storefront/PortalOrders.helpers';
import { formatCancelErrorMessage, toRpcLikeError } from '@/modules/orders/ui/storefront/orderCancellation.helpers';
import { formatValidateErrorMessage } from '@/modules/orders/ui/storefront/orderValidation.helpers';

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

  const transition = async (
    order: Pick<OrderUI, 'id' | 'status'>,
    toStatus: 'cancelled' | 'validated' | 'in_production' | 'shipped',
  ): Promise<unknown | null> => {
    const operationTarget = targetKey;
    let cause: unknown = null;
    try {
      await ordersApi.transition(order.id, {
        toStatus,
        reason: null,
        idempotencyKey: dashboardOrderTransitionKey(order.id, order.status, toStatus),
      });
    } catch (err) {
      console.warn(`[DashboardOrders] transition ${order.status}→${toStatus} failed:`, err);
      cause = err;
    }
    // Fix BCP-5 (recette 2026-09-15/16, CONVENTIONS §8.25 5.1(c)) : recharge
    // dans les deux cas (succes ET conflit) — un rejet 'transition_not_allowed'
    // signifie que le statut reel a change ailleurs, la ligne doit refleter
    // ce vrai statut meme si le dialogue reste ouvert avec le message.
    if (operationTarget === targetKeyRef.current) await reload();
    return cause;
  };

  const cancel = async (orderId: string): Promise<string | null> => {
    const order = orders.find((candidate) => candidate.id === orderId);
    const cause = await transition(order ?? { id: orderId, status: 'draft' }, 'cancelled');
    return cause === null
      ? null
      : formatCancelErrorMessage(toRpcLikeError(cause));
  };

  const validate = async (orderId: string): Promise<string | null> => {
    const order = orders.find((candidate) => candidate.id === orderId);
    const cause = await transition(order ?? { id: orderId, status: 'draft' }, 'validated');
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
