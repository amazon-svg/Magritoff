import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Shop, ShopProduct } from '../../modules/shops';
import { ApiClientError } from '../../platform/api';
import { useStorefrontOrdersApi } from '../contexts/StorefrontModuleClientsContext';
import type { CartLine } from '../components/shop/portal/types';
import type { ResumeLastOrder } from '../components/shop/portal/ResumeBanner';
import {
  rebuildCartFromOrderItems,
  type OrderItemRow,
} from '../components/shop/portal/orderRenewal.helpers';
import { resolveCartLinePricing } from '../components/shop/portal/cartPricing';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useStorefrontOrderLifecycle({
  slug,
  shop,
  products,
  cart,
  sessionShopId,
  createOrderBlockedMessage,
  setCart,
  onCartRenewed,
  onOrderCreated,
}: {
  slug?: string;
  shop: Shop | null;
  products: ShopProduct[];
  cart: CartLine[];
  sessionShopId: string | null;
  createOrderBlockedMessage: string;
  setCart: Dispatch<SetStateAction<CartLine[]>>;
  onCartRenewed: () => void;
  onOrderCreated: () => void;
}) {
  const ordersApi = useStorefrontOrdersApi();
  const checkoutCommandKey = useRef(crypto.randomUUID());
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<ResumeLastOrder | null>(null);
  const [renewalWarnings, setRenewalWarnings] = useState<string[]>([]);

  useEffect(() => {
    const hasStorefrontSession = sessionShopId === shop?.id;
    if (!hasStorefrontSession || !shop?.id) {
      setLastOrder(null);
      return;
    }
    const controller = new AbortController();
    void ordersApi.listPortalOrders(shop.id, controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      const latest = response.datasets.mine.find((order) => order.source === 'v1_1');
      setLastOrder(latest ? {
        id: latest.id,
        status: latest.status,
        total_ht: latest.totalHt,
        created_at: latest.createdAt,
        source: latest.source,
      } : null);
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        console.warn('[StorefrontOrderLifecycle] dernière commande indisponible:', cause);
        setLastOrder(null);
      }
    });
    return () => controller.abort();
  }, [lastOrderId, ordersApi, sessionShopId, shop?.id]);

  useEffect(() => {
    setLastOrderId(null);
    setLastOrder(null);
    setRenewalWarnings([]);
    checkoutCommandKey.current = crypto.randomUUID();
  }, [slug]);

  const renewOrder = useCallback(async (order: { id: string; source: string }) => {
    if (order.source !== 'v1_1') {
      window.alert('Le renouvellement n\'est disponible que pour les commandes récentes (post 17/05/2026).');
      return;
    }
    if (cart.length > 0 && !window.confirm(
      'Votre panier contient déjà des articles. Le renouvellement va le remplacer. Continuer ?',
    )) return;

    let items: OrderItemRow[];
    try {
      const details = await ordersApi.getDraft(order.id);
      items = details.items.map((item) => ({
        product_id: item.productId,
        product_label: item.productLabel,
        clariprint_options: item.clariprintOptions,
        quantity: item.quantity,
        unit_price_ht: item.unitPriceHt,
      }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'erreur réseau';
      console.error('[StorefrontOrderLifecycle] chargement articles impossible:', cause);
      window.alert(`Impossible de charger les articles de cette commande : ${message}.`);
      return;
    }

    const { lines, warnings, stats } = rebuildCartFromOrderItems(items, products);
    if (stats.matched === 0) {
      window.alert(
        `Aucun produit de cette commande n'est plus disponible dans le catalogue actuel.\n\n${warnings.join('\n')}`,
      );
      return;
    }
    setCart(lines);
    setRenewalWarnings(warnings);
    onCartRenewed();
  }, [cart.length, onCartRenewed, ordersApi, products, setCart]);

  const submitCart = useCallback(async () => {
    if (!shop || cart.length === 0) return;
    if (sessionShopId !== shop.id) {
      window.alert('Vous devez être connecté avec le compte propre à cette boutique pour valider votre panier.');
      return;
    }
    if (!shop.tenant_id) {
      console.error('[StorefrontOrderLifecycle] shop.tenant_id absent');
      window.alert('Erreur de configuration boutique (tenant_id manquant). Contactez l administrateur.');
      return;
    }

    const items = cart.map((line) => ({
      productId: typeof line.product.product_id === 'string' && UUID_RE.test(line.product.product_id)
        ? line.product.product_id
        : null,
      productLabel: line.product.name,
      clariprintOptions: (line.product.config as Record<string, unknown> | null) ?? null,
      quantity: line.qty,
      unitPriceHt: resolveCartLinePricing(line).unitPriceHt,
    }));

    try {
      const result = await ordersApi.create({
        shopId: shop.id,
        currency: 'EUR',
        notes: '',
        items,
        idempotencyKey: checkoutCommandKey.current,
      });
      setLastOrderId(result.orderId);
      checkoutCommandKey.current = crypto.randomUUID();
      setCart([]);
      setRenewalWarnings([]);
      onOrderCreated();
    } catch (cause) {
      console.error('[StorefrontOrderLifecycle] création impossible:', cause);
      const message = cause instanceof ApiClientError
        && cause.problem.code === 'orders.permission_denied'
        ? createOrderBlockedMessage
        : cause instanceof Error ? cause.message : 'erreur réseau';
      window.alert(`Erreur lors de la validation du panier : ${message}.\n\nMerci de réessayer.`);
    }
  }, [cart, createOrderBlockedMessage, onOrderCreated, ordersApi, sessionShopId, setCart, shop]);

  return {
    lastOrderId,
    lastOrder,
    renewalWarnings,
    dismissRenewalWarnings: () => setRenewalWarnings([]),
    renewOrder,
    submitCart,
  } as const;
}
