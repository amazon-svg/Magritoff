import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import type { Shop, ShopProduct } from '../../contexts/ShopsContext';
import type { Gamme, ProductDefinition } from '../../utils/productEnrichment';

import { PortalChrome } from './portal/PortalChrome';
import { PortalHome } from './portal/PortalHome';
import { PortalCatalog } from './portal/PortalCatalog';
import { PortalProduct } from './portal/PortalProduct';
import { PortalCart } from './portal/PortalCart';
import type { PortalView, CartLine, BudgetInfo } from './portal/types';
import { TEST_IDS } from '../../lib/testIds';

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
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [view, setView] = useState<PortalView>('home');
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

  // PIM (gammes + definitions) — utilise pour resoudre les images produit
  const [pimGammes, setPimGammes] = useState<Gamme[]>([]);
  const [pimDefinitions, setPimDefinitions] = useState<ProductDefinition[]>([]);

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
    const total_ht = cart.reduce((s, l) => s + l.product.price_ht * l.qty, 0);
    const total_ttc = total_ht * 1.2;
    await supabase.from('shop_orders').insert({
      shop_id: shop.id,
      customer_name: 'Portail B2B',
      customer_email: 'portal@magrit.app',
      customer_phone: '',
      items: cart.map((l) => ({
        product_id: l.product.id,
        name: l.product.name,
        qty: l.qty,
        price_ht: l.product.price_ht,
      })),
      total_ht,
      total_ttc,
      notes: '',
      status: 'pending',
    });
    alert('Commande envoyée. Vous recevrez un email de confirmation.');
    setCart([]);
    setView('home');
  };

  // ─── Rendering ───────────────────────────────────────────────────────────
  if (loading) {
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

  const isDark = shop.theme.mode === 'dark';
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  return (
    <div
      data-testid={TEST_IDS.shop.portal}
      className={`min-h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-bg text-ink'}`}
      data-theme={isDark ? 'dark' : undefined}
      style={{
        // @ts-expect-error — CSS custom props
        ['--shop-primary']: shop.theme.primaryColor,
        ['--shop-accent']: shop.theme.accentColor,
      }}
    >
      <PortalChrome
        shop={shop}
        view={view}
        onView={(v) => {
          setView(v);
          if (v !== 'product') setSelectedProduct(null);
        }}
        cartCount={cartCount}
        budget={budget}
      />

      {view === 'home' && (
        <PortalHome
          shop={shop}
          products={products}
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
          products={products}
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
            setView('cart');
          }}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
        />
      )}

      {view === 'cart' && (
        <PortalCart
          cart={cart}
          budget={budget}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          onSubmit={submitCart}
          onContinue={() => setView('catalog')}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
        />
      )}

      {view === 'orders' && (
        <div
          className="max-w-3xl mx-auto px-9 py-24 text-center"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          <h2
            className="text-ink m-0 mb-3"
            style={{ fontSize: '28px', fontWeight: 300, letterSpacing: '-0.025em' }}
          >
            Mes commandes
          </h2>
          <p
            className="text-ink-muted m-0"
            style={{ fontSize: '14.5px', fontWeight: 400, lineHeight: 1.55 }}
          >
            L'historique de vos commandes sera disponible dans une prochaine itération. En attendant,{' '}
            <button
              onClick={() => setView('catalog')}
              className="text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink"
              style={{ fontWeight: 500 }}
            >
              explorez le catalogue
            </button>
            .
          </p>
        </div>
      )}
    </div>
  );
}
