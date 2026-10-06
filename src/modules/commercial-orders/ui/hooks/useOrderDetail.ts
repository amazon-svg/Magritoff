/**
 * useOrderDetail — E10.16, ecran de detail d une commande.
 *
 * LECTURE SEULE (CA7) : ce hook n expose aucune mutation de prix, aucune
 * mutation de commande — la seule action ecrite ici passe par
 * `OrderStatusButton`/`OrderStatusDialog` (E10.14), deja cables au contrat
 * `changeOrderProductionStep`.
 *
 * E4.4b — le détail préchargé vient de la projection commune des commandes ;
 * les rafraîchissements utilisent également cette lecture. Les ressources
 * annexes restent indépendantes : client et interlocuteur, devis d'origine,
 * étapes de production et dernière transition lue dans le journal. La date
 * de dernière transition ne se déduit jamais de updated_at.
 */
import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceApi } from '@/platform/runtime/workspace-ui-runtime';
import { CommercialOrdersApiClient } from '@/modules/commercial-orders/api/client';
import type { CommercialOrderDetailDto, OrderStepChangeDto } from '@/modules/commercial-orders/api/contracts';
// Import PAR LA FACADE PUBLIQUE de chaque module (`@/modules/customers`,
// `@/modules/commercial-quotes`, `@/modules/production-steps`), jamais un
// chemin profond `api/client` — meme discipline MUX que `OrderStatusDialog`
// (tests/architecture/modular-ui-boundaries.test.ts).
import { CustomersApiClient, type CustomerDetailDto } from '@/modules/customers';
import { CommercialQuotesApiClient, type QuoteDetailDto } from '@/modules/commercial-quotes';
import { ProductionStepsApiClient, type ProductionStepDto } from '@/modules/production-steps';
import { OrdersApiClient } from '@/modules/orders';

export type OrderDetailState = Readonly<{
  order: CommercialOrderDetailDto | null;
  customer: CustomerDetailDto | null;
  quote: QuoteDetailDto | null;
  steps: readonly ProductionStepDto[];
  /** Entree la plus recente du journal (E10.14), ou `null` si la commande n a jamais bouge (decision #5 : afficher alors created_at/created_by). */
  lastStepChange: OrderStepChangeDto | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}>;

export function useOrderDetail(orderId: string | null, initialOrder: CommercialOrderDetailDto | null = null): OrderDetailState {
  const ordersApi = useWorkspaceApi(CommercialOrdersApiClient);
  const unifiedOrdersApi = useWorkspaceApi(OrdersApiClient);
  const customersApi = useWorkspaceApi(CustomersApiClient);
  const quotesApi = useWorkspaceApi(CommercialQuotesApiClient);
  const stepsApi = useWorkspaceApi(ProductionStepsApiClient);

  const [order, setOrder] = useState<CommercialOrderDetailDto | null>(null);
  const [customer, setCustomer] = useState<CustomerDetailDto | null>(null);
  const [quote, setQuote] = useState<QuoteDetailDto | null>(null);
  const [steps, setSteps] = useState<readonly ProductionStepDto[]>([]);
  const [lastStepChange, setLastStepChange] = useState<OrderStepChangeDto | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (prefetched: CommercialOrderDetailDto | null = null) => {
    if (!orderId) {
      setOrder(null);
      setCustomer(null);
      setQuote(null);
      setSteps([]);
      setLastStepChange(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let orderDetail = prefetched?.id === orderId ? prefetched : null;
      if (!orderDetail) {
        const resolved = await unifiedOrdersApi.getUnifiedDetail(orderId);
        if (resolved.origin !== 'quote') throw new Error('Cette commande doit être rechargée depuis la liste.');
        orderDetail = resolved.detail;
      }
      const [customerDetail, quoteDetail, stepsResponse, historyResponse] = await Promise.all([
        customersApi.getDetail(orderDetail.customer_id),
        quotesApi.getDetail(orderDetail.quote_id),
        stepsApi.list(),
        ordersApi.listStepChanges(orderId, { pageSize: 1 }),
      ]);
      setOrder(orderDetail);
      setCustomer(customerDetail);
      setQuote(quoteDetail);
      setSteps(stepsResponse.data);
      setLastStepChange(historyResponse.items[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement de la commande impossible.');
    } finally {
      setLoading(false);
    }
  }, [ordersApi, unifiedOrdersApi, customersApi, quotesApi, stepsApi, orderId]);

  useEffect(() => {
    void load(initialOrder);
  }, [load, initialOrder]);

  return { order, customer, quote, steps, lastStepChange, loading, error, refresh: load };
}
