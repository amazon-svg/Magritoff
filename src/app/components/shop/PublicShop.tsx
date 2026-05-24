import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import type { Shop, ShopProduct } from '../../contexts/ShopsContext';
import type { Gamme, ProductDefinition } from '../../utils/productEnrichment';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

import { PortalHome } from './portal/PortalHome';
import { PortalCatalog } from './portal/PortalCatalog';
import { PortalProduct } from './portal/PortalProduct';
import { PortalCart } from './portal/PortalCart';
import { PortalOrders } from './portal/PortalOrders';
import { PortalThankYou } from './portal/PortalThankYou';
import type { PortalView, CartLine, BudgetInfo } from './portal/types';
import { ShopLayout } from './ShopLayout';
import { ShopForbidden403 } from './ShopForbidden403';
import { resolveShopAccessFromMemberships } from './ShopAccessGuard.helpers';
import {
  filterProductsByExpandedGammes,
  groupProductsByGamme,
  loadExpandedGammes,
  saveExpandedGammes,
} from './ShopGammesSidebar.helpers';
import { applyTax, getTaxRate } from '../../utils/tax';
import {
  tenantOrderInsertSchema,
  tenantOrderItemInsertSchema,
} from '../../../schemas/tenantOrder.schema';

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
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const { tenants, isSuperAdmin, currentTenant } = useTenant();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [view, setView] = useState<PortalView>('home');
  // S-CONSO-3 : order_id du dernier submitCart reussi, lu par PortalThankYou.
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

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

  // Fonction refetch produits (peut être appelee pour rafraichir a chaud).
  // v3 : on filtre les excluded_product_ids (produits retires de la
  // boutique mais gardes dans la bibliotheque via le dialog "Juste de
  // cette boutique" dans DashboardShopEditor).
  const refetchProducts = async (
    shopId: string,
    libraryIds: string[],
    excludedIds: string[] = []
  ) => {
    const excludedSet = new Set(excludedIds);

    const { data: prodData } = await supabase
      .from('shop_products')
      .select('*')
      .eq('shop_id', shopId)
      .order('display_order', { ascending: true });
    const manual = (prodData ?? []) as ShopProduct[];

    let linked: ShopProduct[] = [];
    if (libraryIds.length > 0) {
      const { data: libData } = await supabase
        .from('product_library')
        .select('*')
        .in('library_id', libraryIds)
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (libData) {
        linked = (libData as any[])
          .filter((p) => !excludedSet.has(p.id))
          .map((p) => ({
            id: `lib-${p.id}`,
            shop_id: shopId,
            product_id: p.id,
            name: p.name,
            category: p.category || 'Autres',
            description: p.description || '',
            price_ht: Number(p.price_ht) || 0,
            image_url: p.image_url || '',
            config: p.config || {},
            display_order: 0,
            created_at: p.created_at,
          })) as ShopProduct[];
      }
    }
    const manualIds = new Set(manual.map((p) => p.product_id).filter(Boolean));
    const deduped = linked.filter((p) => !p.product_id || !manualIds.has(p.product_id));
    setProducts([...manual, ...deduped]);
  };

  // ─── Chargement shop + produits + realtime subscription ──────────────────
  useEffect(() => {
    if (!slug) return;
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .maybeSingle();
      if (shopError || !shopData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setShop(shopData as Shop);

      const libraryIds = Array.isArray((shopData as Shop).library_ids)
        ? (shopData as Shop).library_ids
        : [];
      const excludedIds = Array.isArray((shopData as Shop).excluded_product_ids)
        ? (shopData as Shop).excluded_product_ids
        : [];

      await refetchProducts((shopData as Shop).id, libraryIds, excludedIds);

      // PIM lecture publique
      const [gr, dr] = await Promise.all([
        supabase.from('product_gammes').select('*').order('display_order'),
        supabase.from('product_definitions').select('*'),
      ]);
      if (gr.data) setPimGammes(gr.data as Gamme[]);
      if (dr.data) setPimDefinitions(dr.data as ProductDefinition[]);

      // S2.2 — Charger les gammes souscrites du tenant proprietaire de la shop.
      // Lecture publique : si la RLS bloque ou si tenant_id absent, on tombe
      // sur subscribedSlugs=null -> fallback "gammes inferees" cote sidebar.
      const tenantId = (shopData as Shop & { tenant_id?: string }).tenant_id;
      if (tenantId) {
        const { data: subs, error: subsError } = await supabase
          .from('tenant_gamme_subscriptions')
          .select('gamme_slug, active')
          .eq('tenant_id', tenantId)
          .eq('active', true);
        if (!subsError && subs) {
          setSubscribedSlugs(new Set(subs.map((s: any) => s.gamme_slug)));
        } else {
          setSubscribedSlugs(null);
        }
      } else {
        setSubscribedSlugs(null);
      }

      setLoading(false);

      // Realtime : push les updates quand un produit est ajouté, modifié ou
      // supprimé dans shop_products ou product_library (lib liées).
      // Évite d'avoir à refresh manuellement la page pour voir les nouveautés.
      realtimeChannel = supabase
        .channel(`shop-${(shopData as Shop).id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shop_products' },
          () => refetchProducts((shopData as Shop).id, libraryIds, excludedIds)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'product_library' },
          () => refetchProducts((shopData as Shop).id, libraryIds, excludedIds)
        )
        .subscribe();
    })();

    // Refetch quand l'onglet redevient actif (cas pas de realtime)
    const onFocus = () => {
      if (shop) {
        const libraryIds = Array.isArray(shop.library_ids) ? shop.library_ids : [];
        const excludedIds = Array.isArray(shop.excluded_product_ids)
          ? shop.excluded_product_ids
          : [];
        refetchProducts(shop.id, libraryIds, excludedIds);
      }
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ─── SEO : title ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shop) return;
    const orig = document.title;
    document.title = `${shop.name} · Portail impression`;
    return () => { document.title = orig; };
  }, [shop]);

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

  const submitCart = async () => {
    if (!shop || cart.length === 0) return;

    // S-MIGRATION-ORDERS (2026-05-18, ADR-ORDERS-1 architecture.md §4.10) :
    // bascule shop_orders -> tenant_orders + tenant_order_items.
    //
    // AC9 (decision Arnaud B2, pre-flight 17/05) : la RLS tenant_orders_insert
    // exige created_by = auth.uid(). L acheteur DOIT etre authentifie.
    // Coherent avec persona acheteur B2B v1.1 (compte cree par admin tenant).
    if (!user?.id) {
      alert(
        'Vous devez etre connecte pour valider votre panier.\n\nCliquez sur "Se connecter" en haut a droite pour acceder a votre compte B2B.',
      );
      return;
    }

    if (!shop.tenant_id) {
      console.error('[submitCart] shop.tenant_id absent, cannot insert tenant_orders');
      alert(
        'Erreur de configuration boutique (tenant_id manquant). Contactez l administrateur.',
      );
      return;
    }

    const total_ht = cart.reduce((s, l) => s + l.product.price_ht * l.qty, 0);
    // R0 : taxRate du tenant courant. Si shop.tax_regime est defini cote shop,
    // ce serait plus propre, mais pour MVP on garde getTaxRate(currentTenant).

    // ── Phase 1 : INSERT tenant_orders (1 ligne) ─────────────────────────
    const orderInsert = tenantOrderInsertSchema.safeParse({
      tenant_id: shop.tenant_id,
      shop_id: shop.id,
      created_by: user.id,
      status: 'draft',
      total_ht,
      currency: 'EUR',
      notes: '',
    });
    if (!orderInsert.success) {
      console.error('[submitCart] tenant_orders validation Zod failed:', orderInsert.error);
      alert(`Erreur validation panier : ${orderInsert.error.issues[0]?.message ?? 'inconnue'}.`);
      return;
    }

    const { data: orderRow, error: orderErr } = await supabase
      .from('tenant_orders')
      .insert(orderInsert.data)
      .select('id')
      .single();

    if (orderErr || !orderRow) {
      // S3.2-residual AC3 : detection RLS bloquant pour permission can_order revoked
      // pendant la session (race condition cote front qui n'a pas refresh le ctx tenant).
      // PostgREST renvoie code 42501 (insufficient privilege) ou message "row violates
      // row-level security policy" quand la policy with_check fail.
      const msg = orderErr?.message ?? '';
      const isRlsPermissionDenied =
        orderErr?.code === '42501' ||
        msg.includes('row-level security') ||
        msg.includes('violates row-level security policy');
      if (isRlsPermissionDenied) {
        console.warn('[submitCart] RLS INSERT bloque (permission can_order revoquee ?):', msg);
        alert(
          "Permission insuffisante pour créer une commande.\n\nVotre administrateur tenant a peut-être désactivé la création de commandes pour votre compte. Contactez-le pour rétablir l'accès.",
        );
        return;
      }
      console.error('[submitCart] insert tenant_orders failed:', orderErr?.message);
      alert(
        `Erreur lors de la validation du panier : ${orderErr?.message ?? 'reseau'}.\n\nMerci de reessayer.`,
      );
      return;
    }

    // ── Phase 2 : INSERT tenant_order_items (N lignes, 1 par cart line) ───
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const itemsToInsert = cart.map((l) => {
      const isUuid = typeof l.product.id === 'string' && UUID_RE.test(l.product.id);
      return tenantOrderItemInsertSchema.parse({
        order_id: orderRow.id,
        product_id: isUuid ? l.product.id : null,
        product_label: l.product.name,
        clariprint_options: (l.product.config as Record<string, unknown> | null) ?? null,
        quantity: l.qty,
        unit_price_ht: l.product.price_ht,
        line_total_ht: l.product.price_ht * l.qty,
      });
    });

    const { error: itemsErr } = await supabase.from('tenant_order_items').insert(itemsToInsert);

    if (itemsErr) {
      console.error('[submitCart] insert tenant_order_items failed:', itemsErr.message);
      // Rollback compensatoire : delete l order cree pour eviter une commande
      // orpheline sans items. Si le delete echoue aussi, on log et on
      // demande a l admin de cleanup manuellement (cas extreme).
      const { error: rbErr } = await supabase
        .from('tenant_orders')
        .delete()
        .eq('id', orderRow.id);
      if (rbErr) {
        console.error('[submitCart] rollback delete tenant_orders failed:', rbErr.message);
      }
      alert(
        `Erreur lors de la sauvegarde des produits du panier : ${itemsErr.message}.\n\nMerci de reessayer.`,
      );
      return;
    }

    // S3.2-residual AC1 : notification email admin tenant (best-effort).
    // Invocation fire-and-forget — n'attend pas la fin pour ne pas retarder
    // l'UX PortalThankYou. Si Resend down ou pas d'admin trouve, l'edge
    // function logge dans llm_usage_events (endpoint=*-fallback) sans bloquer.
    if (shop.tenant_id) {
      supabase.functions
        .invoke('send-order-notification', {
          body: {
            order_id: orderRow.id,
            tenant_id: shop.tenant_id,
            shop_id: shop.id,
            total_ht,
            currency: 'EUR',
            base_url: window.location.origin,
          },
        })
        .catch((notifErr) => {
          // Best-effort : log seulement, ne remonte rien a l'acheteur.
          console.warn('[submitCart] send-order-notification invoke failed:', notifErr);
        });
    }

    // S-CONSO-3 (Sprint 4 Phase 2) : bascule vers PortalThankYou au lieu
    // d alert + setView('orders'). Artefact visuel persistant pour acheteur
    // B2B (screenshot, transfert compta, archivage).
    setLastOrderId(orderRow.id);
    setCart([]);
    setView('thankYou');
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

  // ─── Access guard shop_only (S2.1 AC3) ───────────────────────────────────
  // Calcul du access *avant* tout rendu de contenu boutique pour eviter la
  // fuite de produits/branding tenant a un user shop_only non-autorise.
  const access = useMemo(() => {
    if (!shop) return 'pending'; // shop pas encore charge — wait
    return resolveShopAccessFromMemberships({
      isAuthenticated: Boolean(user),
      isSuperAdmin,
      memberships: tenants.map((t) => ({
        accessScope: t.accessScope,
        allowedShopIds: t.allowedShopIds,
      })),
      shopId: shop.id,
    });
  }, [shop, user, isSuperAdmin, tenants]);

  // ─── Rendering ───────────────────────────────────────────────────────────
  if (loading || authLoading) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-bg"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-ink-mute-2" strokeWidth={1.5} />
      </div>
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

  if (access === 'forbidden') {
    return <ShopForbidden403 />;
  }

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  return (
    <ShopLayout
      shop={shop}
      view={view}
      onView={(v) => {
        setView(v);
        if (v !== 'product') setSelectedProduct(null);
      }}
      cartCount={cartCount}
      budget={budget}
      gammes={gammePills}
      activeGammeSlugs={expandedGammes}
      onToggleGamme={toggleGamme}
      cartDrawer={
        <PortalCart
          cart={cart}
          budget={budget}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          onSubmit={submitCart}
          onContinue={() => {/* drawer reste ouvert, l'acheteur peut continuer */}}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
          compact
          // S3.2-residual AC3 : back-compat true si pas de tenant resolu ;
          // la RLS DB bloquera de toute facon si la permission est revoked.
          canCreateOrder={currentTenant?.permissions?.can_order ?? true}
        />
      }
    >
      {view === 'home' && (
        <PortalHome
          shop={shop}
          products={filteredProducts}
          onView={setView}
          onSelectProduct={(p) => {
            setSelectedProduct(p);
            setView('product');
          }}
          onReorder={(p) => addToCart(p, 1)}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
        />
      )}

      {view === 'catalog' && (
        <PortalCatalog
          shop={shop}
          products={filteredProducts}
          onSelectProduct={(p) => {
            setSelectedProduct(p);
            setView('product');
          }}
          onAddToCart={(p, qty) => addToCart(p, qty ?? 1)}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
        />
      )}

      {view === 'product' && selectedProduct && (
        <PortalProduct
          product={selectedProduct}
          onBack={() => setView('catalog')}
          onAddToCart={(p, qty) => {
            addToCart(p, qty);
            // S-REWORK-1 : panier est en drawer accessible via cart icon header,
            // pas en page entiere. On retourne sur catalog (l acheteur peut ouvrir
            // le drawer pour verifier puis valider).
            setView('catalog');
          }}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
        />
      )}

      {view === 'orders' && <PortalOrders shopId={shop.id} />}

      {/* S-CONSO-3 : page de confirmation post-submitCart. Si lastOrderId est
          absent (cas edge bug ou refresh), redirect catalog via fallback.  */}
      {view === 'thankYou' && lastOrderId && (
        <PortalThankYou
          orderId={lastOrderId}
          userEmail={user?.email ?? ''}
          onBackToCatalog={() => setView('catalog')}
          onSeeOrders={() => setView('orders')}
        />
      )}
      {view === 'thankYou' && !lastOrderId && (
        // Fallback : pas d order_id => redirect catalog (refresh post-thankYou)
        <>{(() => { setView('catalog'); return null; })()}</>
      )}
    </ShopLayout>
  );
}
