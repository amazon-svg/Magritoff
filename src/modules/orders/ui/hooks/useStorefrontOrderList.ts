import { useStorefrontApi, useStorefrontUiRuntime } from '@/platform/runtime/storefront-ui-runtime';
import { OrdersApiClient } from '@/modules/orders';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { type OrderUI, orderSummaryToUi } from '@/modules/orders/ui/storefront/PortalOrders.helpers';
import { formatCancelErrorMessage, toRpcLikeError } from '@/modules/orders/ui/storefront/orderCancellation.helpers';

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
    let errorMessage: string | null = null;
    try {
      await ordersApi.transition(order.id, {
        toStatus: 'cancelled',
        reason: null,
        idempotencyKey: `storefront-cancel:${order.id}:${order.status}`,
      });
    } catch (cause) {
      console.warn('[StorefrontOrderList] annulation impossible:', cause);
      errorMessage = formatCancelErrorMessage(toRpcLikeError(cause));
    }
    // Fix BCP-5 (recette 2026-09-15/16, CONVENTIONS §8.25 5.1(c)) : que la
    // transition reussisse ou soit rejetee (conflit), le vrai statut peut
    // avoir change (une autre fenetre a valide/annule entre-temps) — on
    // recharge la liste dans les deux cas pour ne jamais laisser une ligne
    // afficher un statut perime pendant que le dialogue reste ouvert avec
    // le message d'erreur.
    await reload();
    if (errorMessage) return errorMessage;
    toast.success('Commande annulée.');
    return null;
  }, [orders, ordersApi, reload]);

  return { orders, loading, error, reload, cancel, auditApi: ordersApi } as const;
}
