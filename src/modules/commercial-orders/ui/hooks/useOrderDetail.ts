/**
 * useOrderDetail — E10.16, ecran de detail d une commande.
 *
 * LECTURE SEULE (CA7) : ce hook n expose aucune mutation de prix, aucune
 * mutation de commande — la seule action ecrite ici passe par
 * `OrderStatusButton`/`OrderStatusDialog` (E10.14), deja cables au contrat
 * `changeOrderProductionStep`.
 *
 * QUATRE LECTURES PUBLIEES, DEJA EXISTANTES (contrat, §8.17 decision #3/#5/
 * #6, reserve (d)) : `getCommercialOrder` (entete, totaux figes, lignes),
 * `getCustomer` (nom du client ET nom de l interlocuteur — `customer_
 * contact_id` est un POINTEUR, jamais recopie, decision #9), `getQuote`
 * (numero du devis d origine, decision #6), `listProductionSteps` (libelle/
 * couleur de l etape courante). Plus `listOrderStepChanges(page[size]=1)`
 * pour la « derniere transition » (CA1, decision #5) : AU JOURNAL, jamais
 * sur `updated_at` (qui n est une garantie d instant metier que par
 * accident de l etat courant du contrat).
 *
 * Cinq appels, pas quatre : `getQuote` n est pas compte dans la reserve (d)
 * du cadrage (« quatre appels »), qui omet la lecture du devis d origine
 * pourtant explicitement demandee par la decision #6 du meme contrat.
 * Ecart de comptage du cadrage, pas une derogation prise ici — la lecture
 * reste additive et deja publiee.
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

export function useOrderDetail(orderId: string | null): OrderDetailState {
  const ordersApi = useWorkspaceApi(CommercialOrdersApiClient);
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

  const load = useCallback(async () => {
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
      const orderDetail = await ordersApi.getDetail(orderId);
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
  }, [ordersApi, customersApi, quotesApi, stepsApi, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { order, customer, quote, steps, lastStepChange, loading, error, refresh: load };
}
