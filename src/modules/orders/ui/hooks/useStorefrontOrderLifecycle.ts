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
// Q14-a round 3 (docs/api/CONVENTIONS.md §8.25 point 3.7 (c-bis), défaut D4)
// — le verdict de fermeté de prix s'APPELLE, il ne se recopie pas. C'est
// exactement le même import que `CheckoutPage.tsx`/`ResumeBanner.tsx`
// (entrée publique du module `catalog`), le garde d'architecture refusant
// l'import direct de `addAsIs.ts` depuis `orders`.
import { canAddAsIs } from '@/modules/catalog/ui/storefront';
import type { ClariprintQuoteResult } from '@/modules/clariprint';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Q14-a round 2 (docs/api/CONVENTIONS.md §8.25 point 3.7 (c) et (c-bis)) — le
 * renouvellement ECHAPPE à C2 : les caractéristiques snapshotées priment (C1
 * est réputée remplie sans être réévaluée), et le prix se recalcule sur le
 * produit d'AUJOURD'HUI. Ce n'est pas un blocage, c'est une INFORMATION :
 * une ligne dont `canAddAsIs` échoue produit un avertissement, un par ligne.
 *
 * **Défaut D1, corrigé (c-bis) : ce n'est PLUS versé dans `renewalWarnings`.**
 * Round 1 les fusionnait dans ce canal, dont le titre affiché par
 * `PortalCart` (« N produit(s) indisponible(s), non ajouté(s) au panier »)
 * fait dire à l'acheteur qu'une ligne bien AJOUTÉE ne l'a pas été. Cette
 * fonction rend donc les NOMS seuls (pas des phrases), consommés par
 * `renewalBannerSections` (`orderRenewal.helpers.ts`) qui compose le texte de
 * sa propre section — jamais mélangés à `renewalWarnings`.
 *
 * **Défaut D4, corrigé (round 3) : le critère s'APPELLE, il ne se recopie
 * PAS.** Round 2 retestait `resolution.source === 'clariprint' ||
 * resolution.source === 'library_cached'` directement ici, en prétendant
 * (faussement) que la réserve `priceHT <= 0` de `canAddAsIs` était
 * « comprise » — elle ne l'était pas : un devis Clariprint réussi à
 * `priceHT: 0` faisait rendre `[]` ici (aucun avertissement) alors que la
 * même ligne, sur la carte, aurait un bouton grisé. La qa-review a reproduit
 * l'écart exact. Le verdict vient maintenant de `canAddAsIs`
 * (`@/modules/catalog/ui/storefront`, la même entrée publique déjà importée
 * ailleurs dans ce module) : une seule règle, appelée deux fois, jamais deux
 * règles qui peuvent diverger.
 *
 * Fonction pure, testée cas par cas : le hook ne fait que l'appeler et
 * exposer son résultat dans un état séparé, `renewalPriceNotFirm`.
 */
export function collectPriceNotFirmProductNames(lines: readonly CartLine[]): string[] {
  const names: string[] = [];
  for (const line of lines) {
    // Même extraction que `cartPricing.ts` (`resolveCartLinePricing`) : le
    // devis stocké, s'il existe, vit dans `product.config.clariprintQuote`.
    const clariprintQuote = (
      line.product.config as { clariprintQuote?: ClariprintQuoteResult } | null | undefined
    )?.clariprintQuote ?? null;
    const eligibility = canAddAsIs(line.product, clariprintQuote);
    if (eligibility.ok) {
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
  // Q20 qa-review round 1, défaut 2 — canal SÉPARÉ de plus : les NOMS des
  // produits dont le prix renouvelé diffère du prix réellement payé à la
  // commande d'origine, calculé par `rebuildCartFromOrderItems` elle-même
  // (elle seule connaît à la fois `item.unit_price_ht` d'origine et le prix
  // fraîchement résolu de la ligne reconstruite).
  const [renewalPriceChanged, setRenewalPriceChanged] = useState<string[]>([]);

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
    setRenewalPriceChanged([]);
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
      // Q20 qa-review round 1, défaut 2 (corrigé) — `unit_price_ht` EST
      // désormais utilisé par `rebuildCartFromOrderItems`, pour comparer le
      // prix réellement payé à la commande d'origine au prix fraîchement
      // résolu de la ligne reconstruite (`priceChanged`). L'ancien
      // commentaire ici affirmait le contraire ; il était vrai avant ce lot,
      // il ne l'est plus. Converti pour rester compatible avec `OrderItemRow`
      // depuis que `DraftOrderItem.unitPriceHt` est un `Money` (chaîne).
      items = details.items.map((item) => ({
        product_id: item.productId,
        product_label: item.productLabel,
        clariprint_options: item.clariprintOptions,
        quantity: item.quantity,
        unit_price_ht: Number(item.unitPriceHt),
      }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'erreur réseau';
      console.error('[StorefrontOrderLifecycle] chargement articles impossible:', cause);
      window.alert(`Impossible de charger les articles de cette commande : ${message}.`);
      return;
    }

    const { lines, warnings, priceChanged, stats } = rebuildCartFromOrderItems(items, products);
    if (stats.matched === 0) {
      window.alert(
        `Aucun produit de cette commande n'est plus disponible dans le catalogue actuel.\n\n${warnings.join('\n')}`,
      );
      return;
    }
    setCart(lines);
    // Q14-a round 2, point 3.7 (c-bis) — TROIS canaux séparés (Q20 qa-review
    // round 1 ajoute le troisième) : les avertissements de correspondance
    // (produit retiré/indisponible) restent dans `renewalWarnings`, sens
    // d'origine, inchangé ; les noms des lignes ajoutées à prix non ferme
    // vont dans `renewalPriceNotFirm` ; les noms des lignes dont le prix a
    // CHANGÉ depuis l'achat vont dans `renewalPriceChanged`. Ne JAMAIS les
    // fusionner (défaut D1) — `renewalBannerSections` compose les trois
    // sections séparément.
    setRenewalWarnings(warnings);
    setRenewalPriceNotFirm(collectPriceNotFirmProductNames(lines));
    setRenewalPriceChanged(priceChanged);
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

    // Q17-a (docs/api/CONVENTIONS.md §8.25 point 12 (f)) — `expectedUnitPriceHt`
    // (Money, chaîne décimale) : ce que l acheteur a VU, jamais un flottant
    // JSON. Le serveur ne l accepte tel quel que pour une ligne qu il ne peut
    // pas vérifier ; pour une ligne catalogue, il le COMPARE à son propre
    // recalcul (point 12 (b), (d)) et refuse en 409 `orders.price_changed`
    // sur écart — traité dans le `catch` ci-dessous.
    const items = cart.map((line) => ({
      productId: typeof line.product.product_id === 'string' && UUID_RE.test(line.product.product_id)
        ? line.product.product_id
        : null,
      productLabel: line.product.name,
      clariprintOptions: line.product.config as CreateOrderCommand['items'][number]['clariprintOptions'],
      quantity: line.qty,
      expectedUnitPriceHt: resolveCartLinePricing(line).unitPriceHt.toFixed(2),
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
      setRenewalPriceChanged([]);
      onOrderCreated();
    } catch (cause) {
      console.error('[StorefrontOrderLifecycle] création impossible:', cause);
      // Q17-a (point 12 (d)) — le prix a bougé entre l affichage et la
      // validation : la seule réponse possible est de recharger, PAS un
      // message technique ni une nouvelle tentative silencieuse.
      const message = cause instanceof ApiClientError
        && cause.problem.code === 'orders.permission_denied'
        ? createOrderBlockedMessage
        : cause instanceof ApiClientError && cause.problem.code === 'orders.price_changed'
          ? 'Les prix de votre panier ont changé. Rechargez la page pour voir les prix à jour.'
          : cause instanceof Error ? cause.message : 'erreur réseau';
      window.alert(`Erreur lors de la validation du panier : ${message}.\n\nMerci de réessayer.`);
    }
  }, [cart, createOrderBlockedMessage, onOrderCreated, ordersApi, sessionShopId, setCart, shop]);

  return {
    lastOrderId,
    lastOrder,
    renewalWarnings,
    renewalPriceNotFirm,
    renewalPriceChanged,
    dismissRenewalWarnings: () => {
      setRenewalWarnings([]);
      setRenewalPriceNotFirm([]);
      setRenewalPriceChanged([]);
    },
    renewOrder,
    submitCart,
  } as const;
}
