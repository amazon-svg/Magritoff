import { useStorefrontApi, useStorefrontUiRuntime } from '@/platform/runtime/storefront-ui-runtime';
import { OrdersApiClient } from '@/modules/orders';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { type OrderUI, orderSummaryToUi } from '@/modules/orders/ui/storefront/PortalOrders.helpers';
import { formatCancelErrorMessage } from '@/modules/orders/ui/storefront/orderCancellation.helpers';
import { toRpcLikeError } from '@/modules/orders/ui/storefront/orderTransitionErrors.helpers';

/**
 * Dépendances injectables de `runCancelOrder` — permet de tester
 * l'orchestration (annulation puis rechargement puis message/toast) sans
 * rendu React, avec des espions vitest (qa-review round 2, 2026-09-16,
 * mutations M4/M5). `transition`/`reload`/`onSuccess` sont les seuls effets
 * de bord : le hook les branche sur `ordersApi`/`reload`/`toast.success`.
 */
export interface CancelOrderDeps {
  findOrder: (orderId: string) => OrderUI | undefined;
  transition: (order: OrderUI) => Promise<unknown>;
  reload: () => Promise<void>;
  onSuccess: () => void;
}

/**
 * Orchestre une annulation de commande draft (Story S3.4) :
 *  1. resout la commande localement (retour immediat si introuvable) ;
 *  2. tente la transition ; capture l'echec sans le laisser remonter ;
 *  3. recharge la liste dans les DEUX cas — succes ET echec (fix BCP-5,
 *     recette 2026-09-15/16, CONVENTIONS §8.25 5.1(c)) : un rejet
 *     ('transition_not_allowed', 'order_not_found', ...) signifie souvent
 *     que le vrai statut a change ailleurs, la ligne doit le refleter meme
 *     si le dialogue reste ouvert avec le message ;
 *  4. n'appelle `onSuccess` (toast) QUE si la transition a reussi — qa-
 *     review round 2 (mutation M5) : jamais de toast de succes sur un echec.
 */
export async function runCancelOrder(orderId: string, deps: CancelOrderDeps): Promise<string | null> {
  const order = deps.findOrder(orderId);
  if (!order) return 'Commande introuvable';

  let cause: unknown = null;
  try {
    await deps.transition(order);
  } catch (err) {
    console.warn('[StorefrontOrderList] annulation impossible:', err);
    cause = err;
  }

  await deps.reload();

  if (cause !== null) {
    return formatCancelErrorMessage(toRpcLikeError(cause));
  }
  deps.onSuccess();
  return null;
}

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

  const cancel = useCallback((orderId: string): Promise<string | null> => (
    runCancelOrder(orderId, {
      findOrder: (id) => orders.find((candidate) => candidate.id === id),
      transition: (order) => ordersApi.transition(order.id, {
        toStatus: 'cancelled',
        reason: null,
        idempotencyKey: `storefront-cancel:${order.id}:${order.status}`,
      }),
      reload,
      onSuccess: () => toast.success('Commande annulée.'),
    })
  ), [orders, ordersApi, reload]);

  return { orders, loading, error, reload, cancel, auditApi: ordersApi } as const;
}
