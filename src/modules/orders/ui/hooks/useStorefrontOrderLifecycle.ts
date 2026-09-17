import { useStorefrontApi, useStorefrontUiRuntime } from '@/platform/runtime/storefront-ui-runtime';
import { OrdersApiClient, type CreateOrderCommand } from '@/modules/orders';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Shop, ShopProduct } from '@/modules/shops';
import { ApiClientError } from '@/platform/api';
import type { CartLine } from '@/modules/orders/ui/storefront/types';
import type { ResumeLastOrder } from '@/modules/orders/ui/storefront/ResumeBanner';
import {
  rebuildCartFromOrderItems,
  type OrderItemRow,
} from '@/modules/orders/ui/storefront/orderRenewal.helpers';
import { resolveCartLinePricing } from '@/modules/orders/ui/storefront/cartPricing';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Q14-a round 2 (docs/api/CONVENTIONS.md §8.25 point 3.7 (c) et (c-bis)) — le
 * renouvellement ECHAPPE à C2 : les caractéristiques snapshotées priment (C1
 * est réputée remplie sans être réévaluée), et le prix se recalcule par
 * `resolveCartLinePricing` sur le produit d'AUJOURD'HUI. Ce n'est pas un
 * blocage, c'est une INFORMATION : une ligne dont la source re-résolue est
 * `prix_marche` ou `zero` (donc PAS `clariprint` ni `library_cached`, la
 * même frontière que C2 — réserve `priceHT <= 0` de `canAddAsIs` comprise,
 * voir `addAsIs.ts`) produit un avertissement, un par ligne.
 *
 * **Défaut D1, corrigé (c-bis) : ce n'est PLUS versé dans `renewalWarnings`.**
 * Round 1 les fusionnait dans ce canal, dont le titre affiché par
 * `PortalCart` (« N produit(s) indisponible(s), non ajouté(s) au panier »)
 * fait dire à l'acheteur qu'une ligne bien AJOUTÉE ne l'a pas été. Cette
 * fonction rend donc les NOMS seuls (pas des phrases), consommés par
 * `renewalBannerSections` (`orderRenewal.helpers.ts`) qui compose le texte de
 * sa propre section — jamais mélangés à `renewalWarnings`.
 *
 * Fonction pure, testée cas par cas : le hook ne fait que l'appeler et
 * exposer son résultat dans un état séparé, `renewalPriceNotFirm`.
 */
export function collectPriceNotFirmProductNames(lines: readonly CartLine[]): string[] {
  const names: string[] = [];
  for (const line of lines) {
    const { resolution } = resolveCartLinePricing(line);
    if (resolution.source === 'clariprint' || resolution.source === 'library_cached') {
      continue;
    }
    names.push(line.product.name);
  }
  return names;
}

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
  const ordersApi = useStorefrontApi(OrdersApiClient);
  const checkoutCommandKey = useRef(crypto.randomUUID());
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<ResumeLastOrder | null>(null);
  const [renewalWarnings, setRenewalWarnings] = useState<string[]>([]);
  // Q14-a round 2, point 3.7 (c-bis) — canal SÉPARÉ, jamais fusionné dans
  // renewalWarnings (défaut D1). Porte les NOMS des produits ajoutés dont le
  // prix n'est pas définitif.
  const [renewalPriceNotFirm, setRenewalPriceNotFirm] = useState<string[]>([]);

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
    setRenewalPriceNotFirm([]);
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
    // Q14-a round 2, point 3.7 (c-bis) — DEUX canaux séparés : les
    // avertissements de correspondance (produit retiré/indisponible) restent
    // dans `renewalWarnings`, sens d'origine, inchangé ; les noms des lignes
    // ajoutées à prix non ferme vont dans `renewalPriceNotFirm`. Ne JAMAIS
    // les fusionner (défaut D1) — `renewalBannerSections` compose les deux
    // sections séparément.
    setRenewalWarnings(warnings);
    setRenewalPriceNotFirm(collectPriceNotFirmProductNames(lines));
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
      clariprintOptions: line.product.config as CreateOrderCommand['items'][number]['clariprintOptions'],
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
      setRenewalPriceNotFirm([]);
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
    renewalPriceNotFirm,
    dismissRenewalWarnings: () => {
      setRenewalWarnings([]);
      setRenewalPriceNotFirm([]);
    },
    renewOrder,
    submitCart,
  } as const;
}
