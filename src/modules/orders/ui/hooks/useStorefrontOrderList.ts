import { useStorefrontApi, useStorefrontUiRuntime } from '@/platform/runtime/storefront-ui-runtime';
import { OrdersApiClient } from '@/modules/orders';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { type OrderUI, orderSummaryToUi } from '@/modules/orders/ui/storefront/PortalOrders.helpers';
import { formatCancelErrorMessage } from '@/modules/orders/ui/storefront/orderCancellation.helpers';

export function useStorefrontOrderList(shopId: string, enabled: boolean) {
  const ordersApi = useStorefrontApi(OrdersApiClient);
  const [orders, setOrders] = useState<OrderUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!shopId || !enabled) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await ordersApi.listPortalOrders(shopId);
      setOrders(response.datasets.mine.map(orderSummaryToUi));
    } catch (cause) {
      console.warn('[StorefrontOrderList] chargement impossible:', cause);
      setOrders([]);
      setError(cause instanceof Error ? cause.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [enabled, ordersApi, shopId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const cancel = useCallback(async (orderId: string): Promise<string | null> => {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return 'Commande introuvable';
    try {
      await ordersApi.transition(order.id, {
        toStatus: 'cancelled',
        reason: null,
        idempotencyKey: `storefront-cancel:${order.id}:${order.status}`,
      });
    } catch (cause) {
      console.warn('[StorefrontOrderList] annulation impossible:', cause);
      return formatCancelErrorMessage(cause instanceof Error ? cause : null);
    }
    toast.success('Commande annulée.');
    await reload();
    return null;
  }, [orders, ordersApi, reload]);

  return { orders, loading, error, reload, cancel, auditApi: ordersApi } as const;
}
