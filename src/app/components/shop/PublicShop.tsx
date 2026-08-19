import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import type { Shop, ShopProduct } from '../../../modules/shops';
import type { Gamme, ProductDefinition } from '../../utils/productEnrichment';

import { PortalHome } from './portal/PortalHome';
import { PortalCatalog } from './portal/PortalCatalog';
import { PortalProduct } from './portal/PortalProduct';
import { PortalCart } from './portal/PortalCart';
import { PortalThankYou } from './portal/PortalThankYou';
import { AccountHub } from './portal/AccountHub';
import { CheckoutPage } from './portal/CheckoutPage';
import type { PortalView, CartLine, BudgetInfo } from './portal/types';
import {
  rebuildCartFromOrderItems,
  type OrderItemRow,
} from './portal/orderRenewal.helpers';
import { ShopLayout } from './ShopLayout';
import { GammePage } from './gamme/GammePage';
import {
  ResumeBanner,
  buildResumeChips,
  type ResumeLastOrder,
} from './portal/ResumeBanner';
import { ShopForbidden403 } from './ShopForbidden403';
import { resolveShopAccess, type ShopAccess } from './ShopAccessGuard.helpers';
import {
  filterProductsByExpandedGammes,
  groupProductsByGamme,
  loadExpandedGammes,
  saveExpandedGammes,
} from './ShopGammesSidebar.helpers';
import { buildShopTaxonomy } from '../../utils/shopTaxonomy';
import { parsePortalPath, shopUrl } from './portal/shopPortalRoutes';
import { DEFAULT_TAX_RATE, getTaxRate } from '../../utils/tax';
import type { StorefrontSession } from '../../../modules/shop-customers';
import type { PublicShopCatalog } from '../../../modules/shops';
import { ApiClientError } from '../../../platform/api';
import { useStorefrontIdentityApi, useStorefrontOrdersApi, useStorefrontShopsApi } from '../../contexts/StorefrontModuleClientsContext';
import { StorefrontDelegationBanner } from './StorefrontDelegationBanner';

/**
 * Portail B2B Magrit — version 2.
 *
 * Surface `/shop/:slug` refondue selon le handoff F en 4 écrans :
 *  - F1 Home portail (raccourcis + commandes récentes + validations)
 *  - F2 Catalogue recherche conversationnelle AI-native
 *  - F3 Fiche produit + configurateur
 *  - F4 Panier + workflow validation N+1 → Achats → Magrit
 *
 * La navigation se fait en local (pas de sous-routes URL pour l'instant —
 * ajoutable plus tard via react-router si besoin). Le state partagé est
 * géré ici ; chaque vue reçoit ses props.
 *
 * Budget / workflow N+1 / centre de coût : mock pour le moment, à brancher
 * sur un futur backend B2B.
 */
export function PublicShop() {
  const params = useParams<{ slug: string; '*': string }>();
  const slug = params.slug;
  const splat = params['*'];
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [blockedAccess, setBlockedAccess] = useState<Extract<
    ShopAccess,
    'authentication_required'
  > | null>(null);
  const ordersApi = useStorefrontOrdersApi();
  const shopsApi = useStorefrontShopsApi();
  const storefrontIdentityApi = useStorefrontIdentityApi();
  const [storefrontSession, setStorefrontSession] = useState<StorefrontSession | null>(null);
  const [storefrontSessionLoading, setStorefrontSessionLoading] = useState(true);
  const [endingStorefrontSession, setEndingStorefrontSession] = useState(false);
  const checkoutCommandKey = useRef(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    storefrontIdentityApi.current()
      .then((current) => { if (!cancelled) setStorefrontSession(current); })
      .catch(() => { if (!cancelled) setStorefrontSession(null); })
      .finally(() => { if (!cancelled) setStorefrontSessionLoading(false); });
    return () => { cancelled = true; };
  }, [storefrontIdentityApi]);

  const endStorefrontSession = async () => {
    setEndingStorefrontSession(true);
    try {
      await storefrontIdentityApi.end();
      setStorefrontSession(null);
    } catch {
      window.alert('Impossible de fermer la session boutique pour le moment. Réessayez.');
    } finally {
      setEndingStorefrontSession(false);
    }
  };

  // S7.1 (ADR §4.19-1) — la vue est DÉRIVÉE de l'URL, plus un state interne.
  // Back/forward navigateur et reload sur URL profonde fonctionnent (AC1).
  const routeMatch = useMemo(() => parsePortalPath(splat), [splat]);
  const view = routeMatch.view;
  const goView = (v: PortalView, productId?: string) => {
    if (slug) navigate(shopUrl(slug, v, productId));
  };
  // URL non canonique (legacy, inconnue) → replace vers la vue résolue,
  // l'historique ne garde pas l'URL morte (AC3). S7.10 : la query string est
  // PRÉSERVÉE (ex. /orders?tab=mine → /account/orders?tab=mine).
  useEffect(() => {
    if (!slug || !routeMatch.redirected) return;
    const param =
      routeMatch.accountSection ?? routeMatch.gammeSlug ?? routeMatch.productId;
    navigate(`${shopUrl(slug, routeMatch.view, param)}${window.location.search}`, {
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, splat]);

  // S-CONSO-3 : order_id du dernier submitCart reussi, lu par PortalThankYou.
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  // S7.1 — fiche produit adressée par URL `/p/:productId` (lookup catalogue).
  const selectedProduct = useMemo(
    () =>
      routeMatch.productId
        ? products.find((p) => p.id === routeMatch.productId) ?? null
        : null,
    [routeMatch.productId, products],
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  // S7.1 — signal d'ouverture du drawer panier (compteur incrémental) : le
  // drawer est un state interne ShopLayout ; l'ancien setView('cart') post-
  // renouvellement était une impasse (aucune branche de rendu 'cart').
  const [cartOpenRequest, setCartOpenRequest] = useState(0);

  // PIM (gammes + definitions) — utilise pour resoudre les images produit
  const [pimGammes, setPimGammes] = useState<Gamme[]>([]);
  const [pimDefinitions, setPimDefinitions] = useState<ProductDefinition[]>([]);

  // S2.2 — Gammes souscrites du tenant qui possede la shop
  // (lecture publique de tenant_gamme_subscriptions filtree active=true).
  // Set vide -> fallback sur les gammes effectivement matchees par le catalogue
  // produit (cf. visibleGammes ci-dessous).
  const [subscribedSlugs, setSubscribedSlugs] = useState<Set<string> | null>(null);

  // S2.2 — Etat des gammes deplices (filtre additif). Hydrate depuis
  // localStorage au mount, persiste a chaque toggle.
  const [expandedGammes, setExpandedGammes] = useState<Set<string>>(new Set());

  const applyCatalog = (catalog: PublicShopCatalog) => {
    setShop(fromPublicShop(catalog));
    setTaxRate(getTaxRate({ tax_regime: catalog.taxRegime }));
    setProducts(catalog.products.map((product) => ({
      id: product.id, shop_id: product.shopId, product_id: product.productId,
      name: product.name, category: product.category, description: product.description,
      price_ht: product.priceHt, image_url: product.imageUrl, config: product.config,
      display_order: product.displayOrder, created_at: product.createdAt,
      tenant_id: product.tenantId, gamme_slug: product.gammeSlug,
    })));
    setPimGammes(catalog.gammes as Gamme[]);
    setPimDefinitions(catalog.definitions as unknown as ProductDefinition[]);
    setSubscribedSlugs(new Set(catalog.subscribedSlugs));
  };

  // ─── Chargement API + rafraîchissement à la reprise de fenêtre ────────────
  useEffect(() => {
    if (!slug || storefrontSessionLoading) return;
    let focusHandler: (() => void) | null = null;
    let refreshTimer: number | null = null;
    let cancelled = false;

    setLoading(true);
    setNotFound(false);
    setBlockedAccess(null);
    setShop(null);
    setTaxRate(DEFAULT_TAX_RATE);
    setProducts([]);
    setPimGammes([]);
    setPimDefinitions([]);
    setSubscribedSlugs(null);

    (async () => {
      // Première lecture volontairement minimale : aucune marque, description,
      // configuration ou donnée catalogue n'est exposée avant le garde d'accès.
      let gateData;
      try { gateData = await shopsApi.publicProbe(slug); }
      catch (probeError) {
        if (cancelled) return;
        setNotFound(probeError instanceof ApiClientError && probeError.problem.status === 404);
        setLoading(false);
        return;
      }
      if (cancelled) return;

      const initialAccess = resolveShopAccess({
        accessMode: gateData.accessMode,
        shopId: gateData.id,
        storefrontShopId: storefrontSession?.identity.shopId ?? null,
      });
      if (initialAccess === 'authentication_required') {
        setBlockedAccess(initialAccess);
        setLoading(false);
        return;
      }

      try {
        const catalog = await shopsApi.publicCatalog(slug);
        if (cancelled) return;
        applyCatalog(catalog);
      } catch (catalogError) {
        if (cancelled) return;
        if (catalogError instanceof ApiClientError && catalogError.problem.status === 401) setBlockedAccess('authentication_required');
        else if (catalogError instanceof ApiClientError && catalogError.problem.status === 403) setBlockedAccess('authentication_required');
        else setNotFound(catalogError instanceof ApiClientError && catalogError.problem.status === 404);
      }
      setLoading(false);

      focusHandler = () => {
        void shopsApi.publicCatalog(slug).then(applyCatalog).catch(() => undefined);
      };
      window.addEventListener('focus', focusHandler);
      refreshTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') focusHandler?.();
      }, 15_000);
    })();

    return () => {
      cancelled = true;
      if (focusHandler) window.removeEventListener('focus', focusHandler);
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, storefrontSessionLoading, storefrontSession?.identity.shopId, shopsApi]);

  // ─── SEO : title ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shop) return;
    const orig = document.title;
    document.title = `${shop.name} · Portail impression`;
    return () => { document.title = orig; };
  }, [shop]);

  // S7.13 (ADR §4.19-4) — boutique PRIVÉE (invite_only, défaut) : noindex sur
  // toutes les vues. Seules les boutiques self_signup sont indexables.
  useEffect(() => {
    if (!shop || shop.access_mode === 'self_signup') return;
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (created) meta?.remove();
    };
  }, [shop?.id, shop?.access_mode]);

  // ─── Budget mock (à remplacer par backend B2B) ────────────────────────────
  // Note : on n'affiche PAS de mention d'approbateur N+1 tant que le workflow
  // de validation n'est pas câblé. Budget = juste consommation / limite.
  const budget: BudgetInfo | undefined = shop
    ? {
        label: 'Communication Groupe',
        used: 8420,
        total: 13500,
      }
    : undefined;

  // ─── Actions panier ──────────────────────────────────────────────────────
  const addToCart = (product: ShopProduct, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + qty } : l
        );
      }
      return [...prev, { product, qty }];
    });
  };
  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  };
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  };

  // S3.3 (Sprint 5) : warnings du dernier renouvellement de commande, affichés
  // en banner dismissable dans PortalCart (cf. setRenewalWarnings([]) pour reset).
  const [renewalWarnings, setRenewalWarnings] = useState<string[]>([]);

  // S7.9 — Dernière commande de l'acheteur sur la boutique (bandeau Reprendre).
  // Best-effort silencieux : anonyme ou erreur RLS → pas de bandeau.
  const [lastOrder, setLastOrder] = useState<ResumeLastOrder | null>(null);
  useEffect(() => {
    const hasStorefrontSession = storefrontSession?.identity.shopId === shop?.id;
    if (!hasStorefrontSession || !shop?.id) {
      setLastOrder(null);
      return;
    }
    const controller = new AbortController();
    ordersApi.listPortalOrders(shop.id, controller.signal).then((response) => {
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
        console.warn('[PublicShop] dernière commande indisponible:', cause);
        setLastOrder(null);
      }
    });
    return () => {
      controller.abort();
    };
    // Re-fetch après un submitCart réussi (lastOrderId change).
  }, [storefrontSession?.identity.shopId, shop?.id, lastOrderId, ordersApi]);

  /**
   * S3.3 AC2/AC3 : Renouveler 1-clic depuis OrderHistoryTable.
   * Query items + rebuild cart (via helper pur) + setCart + view='cart' +
   * warnings remontés au banner PortalCart.
   *
   * Best-effort : si query items échoue, alert simple sans bascule.
   */
  const handleRenewOrder = async (order: { id: string; source: string }) => {
    if (order.source !== 'v1_1') {
      alert('Le renouvellement n\'est disponible que pour les commandes récentes (post 17/05/2026).');
      return;
    }

    // Si le cart actuel n'est pas vide, on confirme avant de l'écraser.
    if (cart.length > 0) {
      const ok = window.confirm(
        'Votre panier contient déjà des articles. Le renouvellement va le remplacer. Continuer ?',
      );
      if (!ok) return;
    }

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
      console.error('[handleRenewOrder] API items failed:', cause);
      alert(`Impossible de charger les articles de cette commande : ${message}.`);
      return;
    }

    const { lines, warnings, stats } = rebuildCartFromOrderItems(
      items,
      products,
    );

    if (stats.matched === 0) {
      // Aucun produit récupérable : on ne bascule pas le panier mais on affiche les warnings
      alert(
        `Aucun produit de cette commande n'est plus disponible dans le catalogue actuel.\n\n${warnings.join('\n')}`,
      );
      return;
    }

    setCart(lines);
    setRenewalWarnings(warnings);
    // S7.1 : le panier est un drawer, pas une page — retour catalogue + drawer
    // ouvert (corrige l'impasse setView('cart') sans branche de rendu).
    goView('catalog');
    setCartOpenRequest((n) => n + 1);
  };

  const submitCart = async () => {
    if (!shop || cart.length === 0) return;

    // La commande API exige une session : l acteur, son périmètre boutique et
    // sa permission de commander sont vérifiés côté serveur.
    const hasStorefrontSession = storefrontSession?.identity.shopId === shop.id;
    if (!hasStorefrontSession) {
      alert(
        'Vous devez être connecté avec le compte propre à cette boutique pour valider votre panier.',
      );
      return;
    }

    if (!shop.tenant_id) {
      console.error('[submitCart] shop.tenant_id absent, API order creation impossible');
      alert(
        'Erreur de configuration boutique (tenant_id manquant). Contactez l administrateur.',
      );
      return;
    }

    // Commande atomique API : entête + lignes + receipt d idempotence sont
    // validés et écrits dans une seule transaction SQL.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const items = cart.map((l) => {
      const libraryRef =
        typeof l.product.product_id === 'string' && UUID_RE.test(l.product.product_id)
          ? l.product.product_id
          : null;
      return {
        productId: libraryRef,
        productLabel: l.product.name,
        clariprintOptions: (l.product.config as Record<string, unknown> | null) ?? null,
        quantity: l.qty,
        unitPriceHt: l.product.price_ht,
      };
    });
    let orderId: string;
    try {
      const result = await ordersApi.create({
        shopId: shop.id,
        currency: 'EUR',
        notes: '',
        items,
        idempotencyKey: checkoutCommandKey.current,
      });
      orderId = result.orderId;
    } catch (cause) {
      console.error('[submitCart] API create failed:', cause);
      const message = cause instanceof ApiClientError
        && cause.problem.code === 'orders.permission_denied'
        ? createOrderBlockedMessage
        : cause instanceof Error ? cause.message : 'erreur réseau';
      alert(`Erreur lors de la validation du panier : ${message}.\n\nMerci de réessayer.`);
      return;
    }

    // S-CONSO-3 (Sprint 4 Phase 2) : bascule vers PortalThankYou au lieu
    // d alert + setView('orders'). Artefact visuel persistant pour acheteur
    // B2B (screenshot, transfert compta, archivage).
    setLastOrderId(orderId);
    checkoutCommandKey.current = crypto.randomUUID();
    setCart([]);
    setRenewalWarnings([]); // S3.3 : clear warnings après submit réussi
    goView('thankYou');
  };

  // ─── S2.2 Hydratation localStorage des gammes deplices ───────────────────
  useEffect(() => {
    if (!slug) return;
    setExpandedGammes(loadExpandedGammes(slug));
  }, [slug]);

  // ─── S2.2 Persistance auto-save a chaque toggle ──────────────────────────
  useEffect(() => {
    if (!slug) return;
    saveExpandedGammes(slug, expandedGammes);
  }, [slug, expandedGammes]);

  const toggleGamme = (gammeSlug: string) => {
    setExpandedGammes((prev) => {
      const next = new Set(prev);
      if (next.has(gammeSlug)) next.delete(gammeSlug);
      else next.add(gammeSlug);
      return next;
    });
  };

  // S2.18 — Sélection depuis le méga-menu (famille ou sous-catégorie) : remplace
  // les filtres actifs par les gammes ciblées et bascule sur le catalogue.
  // Sélectionner une FAMILLE (ou une gamme) réinitialise la présélection format.
  const selectGammes = (gammeSlugs: string[]) => {
    setExpandedGammes(new Set(gammeSlugs));
    setPendingFormat(null);
    goView('catalog');
  };

  // Sélection méga-menu (2026-07-08) : présélection de la facette Format du
  // catalogue pour les sous-catégories DÉRIVÉES par format (ADR-4.17). Le filtre
  // reste au niveau FAMILLE (gammeSlugs = racine) ; `formatKey` raffine ensuite
  // via la facette Format existante (S2.19). Sans formatKey (sous-cat de gamme
  // classique) → comportement identique à selectGammes.
  const [pendingFormat, setPendingFormat] = useState<string | null>(null);

  // UM10.4 — tous ces états appartiennent à une boutique précise. React peut
  // réutiliser cette instance de PublicShop lors d'une navigation A → B ; sans
  // reset explicite, panier, confirmation et filtres traverseraient la frontière.
  useEffect(() => {
    setCart([]);
    setRenewalWarnings([]);
    setLastOrderId(null);
    setLastOrder(null);
    setPendingFormat(null);
    setCartOpenRequest(0);
    checkoutCommandKey.current = crypto.randomUUID();
  }, [slug]);

  const selectSubcategory = (gammeSlugs: string[], formatKey?: string) => {
    setExpandedGammes(new Set(gammeSlugs));
    setPendingFormat(formatKey ?? null);
    goView('catalog');
  };

  // ─── S2.2 Memoisation grouping + filteredProducts ────────────────────────
  const gammeMap = useMemo(
    () => groupProductsByGamme(products, pimGammes),
    [products, pimGammes],
  );
  const filteredProducts = useMemo(
    () => filterProductsByExpandedGammes(products, gammeMap, expandedGammes),
    [products, gammeMap, expandedGammes],
  );

  // S2.2 Liste des gammes a afficher dans la sidebar :
  //  - Si subscribedSlugs non-null et non-vide -> filtrer pimGammes par souscription
  //  - Sinon (null = pas de tenant_id, ou Set vide) -> fallback gammes inferees
  //    depuis les produits effectivement matches
  const visibleGammes = useMemo(() => {
    if (subscribedSlugs && subscribedSlugs.size > 0) {
      return pimGammes.filter((g) => subscribedSlugs.has(g.slug));
    }
    // Fallback : gammes effectivement presentes dans le catalogue produit
    const inferred = new Set(Array.from(gammeMap.keys()));
    return pimGammes.filter((g) => inferred.has(g.slug));
  }, [pimGammes, subscribedSlugs, gammeMap]);

  // ─── S-REWORK-1 Pilules gammes horizontales (remplace sidebar S2.2) ──────
  // CRITICAL : ce useMemo DOIT etre declare AVANT les early returns ci-dessous
  // pour respecter la regle React des hooks (sinon "Rendered more hooks than
  // during the previous render"). Bug initialement introduit ligne 382 fixe
  // 2026-05-11.
  const gammePills = useMemo(() => {
    return visibleGammes
      .map((g) => ({
        slug: g.slug,
        name: g.name,
        count: gammeMap.get(g.slug)?.length ?? 0,
      }))
      .filter((p) => p.count > 0); // n'affiche que les gammes avec produits
  }, [visibleGammes, gammeMap]);

  // S2.18 — Taxonomie familles → sous-catégories pour le méga-menu, bâtie sur
  // l'arbre COMPLET des gammes PIM (pimGammes) et le catalogue complet. Le
  // squelette démo-friendly (familles racines, compteurs 0) est géré dans
  // buildShopTaxonomy quand aucun produit ne matche.
  const taxonomy = useMemo(
    () => buildShopTaxonomy(products, pimGammes),
    [products, pimGammes],
  );

  // ─── Garde storefront ────────────────────────────────────────────────────
  // Calcul avant tout rendu de contenu : une identité Magrit n'accorde jamais
  // implicitement l'accès à une boutique privée.
  const access = useMemo(() => {
    if (!shop) return 'pending'; // shop pas encore charge — wait
    return resolveShopAccess({
      accessMode: shop.access_mode ?? 'invite_only',
      shopId: shop.id,
      storefrontShopId: storefrontSession?.identity.shopId ?? null,
    });
  }, [shop, storefrontSession?.identity.shopId]);

  // ─── Rendering ───────────────────────────────────────────────────────────
  // Le reset des effects intervient après le rendu. Ce garde empêche donc la
  // boutique précédente d'être peinte, même pendant cette fenêtre React.
  if (loading || storefrontSessionLoading || (shop !== null && shop.slug !== slug)) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-bg"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-ink-mute-2" strokeWidth={1.5} />
      </div>
    );
  }
  if (blockedAccess) {
    return (
      <ShopForbidden403
        authenticationRequired={blockedAccess === 'authentication_required'}
        shopSlug={slug}
        onStorefrontAuthenticated={setStorefrontSession}
      />
    );
  }
  if (notFound || !shop) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-bg px-6"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        <div className="text-center max-w-md">
          <h1
            className="text-ink m-0 mb-3"
            style={{ fontSize: '32px', fontWeight: 300, letterSpacing: '-0.025em' }}
          >
            Portail introuvable
          </h1>
          <p
            className="text-ink-muted m-0"
            style={{ fontSize: '14.5px', fontWeight: 400, lineHeight: 1.55 }}
          >
            Le lien que vous avez suivi n'est plus actif. Vérifiez auprès de votre service Achats.
          </p>
        </div>
      </div>
    );
  }

  if (access === 'authentication_required') {
    return (
      <ShopForbidden403
        authenticationRequired={access === 'authentication_required'}
        shopSlug={slug}
        onStorefrontAuthenticated={setStorefrontSession}
      />
    );
  }

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  // S7.7 — montant HT du panier (affiché sur le bouton header, décision D3).
  const cartTotalHT = cart.reduce((s, l) => s + l.product.price_ht * l.qty, 0);
  const hasStorefrontSession = storefrontSession?.identity.shopId === shop.id;
  const canCreateOrder = hasStorefrontSession
    || shop.access_mode === 'self_signup';
  const createOrderBlockedMessage = 'Connectez-vous avec le compte propre à cette boutique pour commander.';

  // S7.9 — Bandeau Reprendre (chips dérivés de la donnée, vide → absent).
  const resumeChips = buildResumeChips({ cartCount, cartTotalHT, lastOrder });
  const handleResumeChip = (key: 'cart' | 'renew' | 'track') => {
    if (key === 'cart') setCartOpenRequest((n) => n + 1);
    else if (key === 'renew' && lastOrder) {
      void handleRenewOrder({ id: lastOrder.id, source: lastOrder.source });
    } else if (key === 'track') goView('orders');
  };

  return (
    <>
      {storefrontSession?.identity.kind === 'delegated_shop_customer'
        && storefrontSession.identity.shopId === shop.id && (
          <StorefrontDelegationBanner
            session={storefrontSession}
            ending={endingStorefrontSession}
            onEnd={() => void endStorefrontSession()}
          />
        )}
    <ShopLayout
      shop={shop}
      view={view}
      onView={(v) => goView(v)}
      cartOpenRequest={cartOpenRequest}
      cartCount={cartCount}
      cartTotalHT={cartTotalHT}
      searchIndex={products}
      pimGammes={pimGammes}
      onSelectProduct={(p) => goView('product', p.id)}
      onOpenGamme={(gSlug) => goView('gamme', gSlug)}
      onAskMagrit={() => goView('catalog')}
      storefrontSession={storefrontSession}
      budget={budget}
      gammes={gammePills}
      activeGammeSlugs={expandedGammes}
      onToggleGamme={toggleGamme}
      taxonomy={taxonomy}
      // S7.7 — clic FAMILLE méga-menu → page gamme /g/:famille (SEO-able).
      // Repli filtre catalogue si la clé famille manque (rétro-compat).
      onSelectFamily={(slugs, familyKey) =>
        familyKey ? goView('gamme', familyKey) : selectGammes(slugs)
      }
      onSelectSubcategory={selectSubcategory}
      cartDrawer={
        <PortalCart
          cart={cart}
          taxRate={taxRate}
          budget={budget}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          // S7.12 (ADR 4.20) — le drawer mène au récap /checkout : c'est là
          // que se joue l'identification éventuelle puis le submitCart.
          onSubmit={() => {
            if (view === 'checkout') {
              void submitCart();
              return;
            }
            goView('checkout');
          }}
          onContinue={() => {/* drawer reste ouvert, l'acheteur peut continuer */}}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
          compact
          canCreateOrder={canCreateOrder}
          createOrderBlockedMessage={createOrderBlockedMessage}
          // S3.3 : banner warnings affiché si dernier renew a skip des items.
          renewalWarnings={renewalWarnings}
          onDismissRenewalWarnings={() => setRenewalWarnings([])}
        />
      }
    >
      {/* S7.9 — Bandeau Reprendre : riche sur la home, compact sur les pages
          gammes (le récurrent ne repasse pas par la home). */}
      {view === 'home' && (
        <ResumeBanner chips={resumeChips} onChip={handleResumeChip} variant="rich" />
      )}
      {view === 'gamme' && (
        <ResumeBanner chips={resumeChips} onChip={handleResumeChip} variant="compact" />
      )}

      {view === 'home' && (
        <PortalHome
          shop={shop}
          products={filteredProducts}
          onView={goView}
          onSelectProduct={(p) => goView('product', p.id)}
          onReorder={(p) => addToCart(p, 1)}
          onOpenGamme={(gSlug) => goView('gamme', gSlug)}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
        />
      )}

      {view === 'catalog' && (
        <PortalCatalog
          shop={shop}
          taxRate={taxRate}
          products={filteredProducts}
          onSelectProduct={(p) => goView('product', p.id)}
          onAddToCart={(p, qty) => addToCart(p, qty ?? 1)}
          onGoHome={() => goView('home')}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
          searchIndex={products}
          onSelectFamily={selectGammes}
          onSelectSubcategory={selectSubcategory}
          initialFormat={pendingFormat}
        />
      )}

      {/* S7.3 — page gamme-configurateur (expérience déterminante v2) */}
      {view === 'gamme' && (
        <GammePage
          shop={shop}
          taxRate={taxRate}
          gammeSlug={routeMatch.gammeSlug}
          products={products}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
          onAddToCart={(p, qty) => {
            addToCart(p, qty);
            // Drawer panier ouvert, l'acheteur RESTE sur la page (spec UX :
            // achat multi-gammes fréquent en B2B).
            setCartOpenRequest((n) => n + 1);
          }}
          onGoHome={() => goView('home')}
          onGoCatalog={() => goView('catalog')}
          onGoGamme={(gSlug) => goView('gamme', gSlug)}
          onSelectProduct={(p) => goView('product', p.id)}
          onAskMagrit={() => goView('catalog')}
        />
      )}

      {view === 'product' && selectedProduct && (
        <PortalProduct
          product={selectedProduct}
          taxRate={taxRate}
          onBack={() => goView('catalog')}
          onAddToCart={(p, qty) => {
            addToCart(p, qty);
            // S-REWORK-1 : panier est en drawer accessible via cart icon header,
            // pas en page entiere. On retourne sur catalog (l acheteur peut ouvrir
            // le drawer pour verifier puis valider).
            goView('catalog');
          }}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
        />
      )}
      {/* S7.1 AC3 : /p/:id introuvable dans le catalogue chargé → catalog. */}
      {view === 'product' && !selectedProduct && slug && (
        <Navigate to={shopUrl(slug, 'catalog')} replace />
      )}

      {/* S7.12 — checkout ≤ 2 écrans (identification + récap, ADR §4.20) */}
      {view === 'checkout' && (
        <CheckoutPage
          shop={shop}
          cart={cart}
          taxRate={taxRate}
          canCreateOrder={canCreateOrder}
          createOrderBlockedMessage={createOrderBlockedMessage}
          storefrontSession={storefrontSession}
          onStorefrontAuthenticated={setStorefrontSession}
          onSubmit={submitCart}
          onGoCatalog={() => goView('catalog')}
        />
      )}

      {/* S7.10 — hub Mon compte (commandes / devis / profil) */}
      {view === 'account' && (
        <AccountHub
          shop={shop}
          hasStorefrontSession={storefrontSession?.identity.shopId === shop.id}
          section={routeMatch.accountSection ?? 'orders'}
          onSection={(s) => goView('account', s)}
          onRenewOrder={handleRenewOrder}
          onGoHome={() => goView('home')}
          storefrontSession={storefrontSession}
          onAuthenticated={setStorefrontSession}
          onSignOut={endStorefrontSession}
        />
      )}

      {/* S-CONSO-3 : page de confirmation post-submitCart. Si lastOrderId est
          absent (reload direct sur /thank-you), redirect catalog (S7.1 AC4). */}
      {view === 'thankYou' && lastOrderId && (
        <PortalThankYou
          orderId={lastOrderId}
          taxRate={taxRate}
          userEmail={storefrontSession?.customer.email ?? ''}
          onBackToCatalog={() => goView('catalog')}
          onSeeOrders={() => goView('orders')}
        />
      )}
      {view === 'thankYou' && !lastOrderId && slug && (
        <Navigate to={shopUrl(slug, 'catalog')} replace />
      )}
    </ShopLayout>
    </>
  );
}

function fromPublicShop(catalog: PublicShopCatalog): Shop {
  const shop = catalog.shop;
  return {
    id: shop.id, tenant_id: shop.tenantId, slug: shop.slug, name: shop.name,
    description: shop.description, theme: shop.theme, logo_url: shop.logoUrl,
    address: shop.address, contact_email: shop.contactEmail, active: shop.active,
    library_ids: [], excluded_product_ids: [], hero_image_url: shop.heroImageUrl,
    tagline: shop.tagline, pim_catalog_mode: false, pim_gamme_slugs: [],
    access_mode: shop.accessMode, created_at: shop.createdAt,
    custom_mockups: catalog.customMockups,
  };
}
