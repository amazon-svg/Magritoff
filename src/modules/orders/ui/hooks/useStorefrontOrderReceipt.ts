import { useStorefrontApi, useStorefrontUiRuntime } from '@/platform/runtime/storefront-ui-runtime';
import { OrdersApiClient } from '@/modules/orders';
import { useEffect, useState } from 'react';
import type { DraftOrder } from '@/modules/orders';

export function useStorefrontOrderReceipt(orderId: string) {
  const ordersApi = useStorefrontApi(OrdersApiClient);
  const [order, setOrder] = useState<DraftOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setError('Référence introuvable');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setOrder(null);
    setError(null);
    setLoading(true);
    void ordersApi.getDraft(orderId, controller.signal).then((details) => {
      if (!controller.signal.aborted) setOrder(details);
    }).catch((cause) => {
      if (controller.signal.aborted) return;
      console.warn('[StorefrontOrderReceipt] chargement impossible:', cause);
      setError(cause instanceof Error ? cause.message : 'Commande introuvable');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [orderId, ordersApi]);

  return { order, loading, error } as const;
}
