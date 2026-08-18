/**
 * Portail de commandes du compte boutique courant.
 *
 * Cette surface est volontairement distincte du workflow Magrit : elle ne
 * présente que les commandes du couple (boutique, compte client) résolu par le
 * cookie HttpOnly. Un client peut consulter, renouveler, éditer ou annuler son
 * propre brouillon ; validation, approbation et production restent internes.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useOrdersApi } from '../../../contexts/ModuleClientsContext';
import { TEST_IDS } from '../../../lib/testIds';
import { type OrderUI, orderSummaryToUi } from './PortalOrders.helpers';
import { OrderHistoryTable } from './OrderHistoryTable';
import { PortalOrderEditor } from './PortalOrderEditor';
import { CancelOrderConfirmDialog } from './CancelOrderConfirmDialog';
import { formatCancelErrorMessage } from './orderCancellation.helpers';

interface Props {
  shopId: string;
  hasStorefrontSession?: boolean;
  onRenewOrder?: (order: OrderUI) => void | Promise<void>;
  onNavigateToCatalog?: () => void;
}

export function PortalOrders({
  shopId,
  hasStorefrontSession = false,
  onRenewOrder,
  onNavigateToCatalog,
}: Props) {
  const ordersApi = useOrdersApi();
  const [orders, setOrders] = useState<OrderUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<OrderUI | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<OrderUI | null>(null);

  const loadMine = useCallback(async () => {
    if (!shopId || !hasStorefrontSession) {
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
      console.warn('[PortalOrders] own orders unavailable:', cause);
      setOrders([]);
      setError(cause instanceof Error ? cause.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [shopId, hasStorefrontSession, ordersApi]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  const handleCancelConfirm = useCallback(async (orderId: string): Promise<string | null> => {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return 'Commande introuvable';

    try {
      await ordersApi.transition(order.id, {
        toStatus: 'cancelled',
        reason: null,
        idempotencyKey: `storefront-cancel:${order.id}:${order.status}`,
      });
    } catch (cause) {
      console.warn('[PortalOrders] owner cancellation failed:', cause);
      return formatCancelErrorMessage(cause instanceof Error ? cause : null);
    }

    toast.success('Commande annulée.');
    await loadMine();
    return null;
  }, [orders, ordersApi, loadMine]);

  return (
    <div
      data-testid={TEST_IDS.shop.ordersList}
      className="max-w-5xl mx-auto px-9 py-12"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      <h2
        className="text-ink m-0 mb-2"
        style={{ fontSize: '28px', fontWeight: 300, letterSpacing: '-0.025em' }}
      >
        Mes commandes
      </h2>
      <p className="text-ink-muted m-0 mb-8" style={{ fontSize: '13.5px' }}>
        Les commandes passées avec votre compte dans cette boutique.
      </p>

      {orders.length === 0 && !loading && !error ? (
        <div data-testid={TEST_IDS.shop.ordersEmptyState} className="text-center py-16">
          <div aria-hidden="true" style={{ fontSize: '32px', marginBottom: '12px' }}>🛒</div>
          <h3 className="text-ink m-0 mb-2" style={{ fontSize: '16px', fontWeight: 500 }}>
            Aucune commande pour le moment
          </h3>
          <p className="text-ink-muted m-0" style={{ fontSize: '13.5px' }}>
            Vos prochaines commandes apparaîtront ici.
          </p>
          {onNavigateToCatalog && (
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="mt-5 inline-flex items-center px-3.5 py-2 rounded border border-line bg-paper text-ink-muted hover:text-ink hover:border-ink-mute-2"
              style={{ fontSize: '13px' }}
            >
              Voir le catalogue →
            </button>
          )}
        </div>
      ) : (
        <OrderHistoryTable
          orders={orders}
          loading={loading}
          error={error}
          persistKey={`orderHistory:storefront:${shopId}`}
          onCancelOrder={setOrderToCancel}
          onEditOrder={setOrderToEdit}
          onRenewOrder={onRenewOrder}
        />
      )}

      <CancelOrderConfirmDialog
        orderId={orderToCancel?.id ?? null}
        orderShortId={orderToCancel?.id
          ? orderToCancel.id.replace(/-/g, '').slice(0, 8).toUpperCase()
          : undefined}
        onConfirm={handleCancelConfirm}
        onClose={() => setOrderToCancel(null)}
      />

      <PortalOrderEditor
        order={orderToEdit}
        onClose={() => setOrderToEdit(null)}
        onSaved={loadMine}
      />
    </div>
  );
}
