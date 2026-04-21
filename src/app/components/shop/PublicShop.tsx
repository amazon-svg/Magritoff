import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ShoppingCart, X, Plus, Minus, Loader2, Check } from 'lucide-react';
import { supabase } from '/utils/supabase/client';
import type { Shop, ShopProduct } from '../../contexts/ShopsContext';
import { ProductImage } from './ProductImage';
import { enrichProduct, Gamme, ProductDefinition } from '../../utils/productEnrichment';
import { productSchema, faqSchema, breadcrumbSchema, combineSchemas } from '../../utils/schemaOrg';

interface CartLine {
  product: ShopProduct;
  qty: number;
}

export function PublicShop() {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ShopProduct | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [pimGammes, setPimGammes] = useState<Gamme[]>([]);
  const [pimDefinitions, setPimDefinitions] = useState<ProductDefinition[]>([]);

  useEffect(() => {
    if (!slug) return;
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

      const { data: prodData } = await supabase
        .from('shop_products')
        .select('*')
        .eq('shop_id', (shopData as Shop).id)
        .order('display_order', { ascending: true });
      const manualShopProducts = (prodData ?? []) as ShopProduct[];

      // Produits des bibliothèques liées (auto-sync)
      const libraryIds = Array.isArray((shopData as Shop).library_ids) ? (shopData as Shop).library_ids : [];
      let linkedLibProducts: ShopProduct[] = [];
      if (libraryIds.length > 0) {
        const { data: libData } = await supabase
          .from('product_library')
          .select('*')
          .in('library_id', libraryIds)
          .eq('active', true)
          .order('created_at', { ascending: false });
        if (libData) {
          linkedLibProducts = (libData as any[]).map((p) => ({
            id: `lib-${p.id}`,
            shop_id: (shopData as Shop).id,
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

      // Dédupliquer par product_id : un produit de bibliothèque déjà ajouté
      // manuellement via shop_products n'est pas doublé.
      const manualProductIds = new Set(manualShopProducts.map((p) => p.product_id).filter(Boolean));
      const libFiltered = linkedLibProducts.filter((p) => !p.product_id || !manualProductIds.has(p.product_id));
      setProducts([...manualShopProducts, ...libFiltered]);

      // Charge le PIM (gammes + definitions) pour enrichissement public (RLS: lecture ouverte)
      const [gammesRes, defsRes] = await Promise.all([
        supabase.from('product_gammes').select('*').order('display_order'),
        supabase.from('product_definitions').select('*'),
      ]);
      if (gammesRes.data) setPimGammes(gammesRes.data as Gamme[]);
      if (defsRes.data) setPimDefinitions(defsRes.data as ProductDefinition[]);

      setLoading(false);
    })();
  }, [slug]);

  const categories = useMemo(() => {
    const map = new Map<string, ShopProduct[]>();
    for (const p of products) {
      const cat = p.category || 'Autres';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries());
  }, [products]);

  const visibleCategories = useMemo(() => {
    if (activeCategory === 'all') return categories;
    return categories.filter(([cat]) => cat === activeCategory);
  }, [categories, activeCategory]);

  // SEO : title/meta du document pour la boutique publique
  useEffect(() => {
    if (!shop) return;
    const origTitle = document.title;
    document.title = shop.name;
    const meta = document.querySelector('meta[name="description"]');
    const prevMetaContent = meta?.getAttribute('content') ?? null;
    if (meta && shop.description) meta.setAttribute('content', shop.description);
    return () => {
      document.title = origTitle;
      if (meta && prevMetaContent != null) meta.setAttribute('content', prevMetaContent);
    };
  }, [shop]);

  const addToCart = (p: ShopProduct, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) return prev.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + qty } : l));
      return [...prev, { product: p, qty }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotalHT = cart.reduce((s, l) => s + l.product.price_ht * l.qty, 0);
  const cartTotalTTC = cartTotalHT * 1.2;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (notFound || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Boutique introuvable</h1>
          <p className="text-sm text-gray-600">Le lien que vous avez suivi n'est plus valide.</p>
        </div>
      </div>
    );
  }

  const isDark = shop.theme.mode === 'dark';
  const bg = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const surface = isDark ? 'bg-gray-800' : 'bg-white';
  const border = isDark ? 'border-gray-700' : 'border-gray-200';
  const textPrim = isDark ? 'text-gray-100' : 'text-gray-900';
  const textSec = isDark ? 'text-gray-300' : 'text-gray-600';
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';

  // En mode sombre, le primaryColor (souvent foncé) n'est pas lisible pour du
  // texte → on force le blanc. En clair, on garde le primaryColor.
  const titleColor = isDark ? '#ffffff' : shop.theme.primaryColor;
  const priceColor = isDark ? shop.theme.accentColor : shop.theme.primaryColor;

  return (
    <div
      className={`min-h-screen ${bg} ${textPrim}`}
      style={{ ['--primary' as any]: shop.theme.primaryColor, ['--accent' as any]: shop.theme.accentColor }}
    >
      {/* Header */}
      <header
        className={`${surface} border-b ${border} sticky top-0 z-40`}
        style={{ borderColor: shop.theme.primaryColor + '30' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {shop.logo_url && (
              <img src={shop.logo_url} alt={shop.name} className="h-10 w-10 object-contain rounded" />
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-lg truncate" style={{ color: titleColor }}>
                {shop.name}
              </h1>
              {shop.address && <p className={`text-xs ${muted} truncate`}>{shop.address}</p>}
            </div>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2"
            style={{ backgroundColor: shop.theme.primaryColor }}
          >
            <ShoppingCart className="w-4 h-4" />
            Panier
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 text-xs font-bold text-white rounded-full w-5 h-5 flex items-center justify-center"
                style={{ backgroundColor: shop.theme.accentColor }}
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Barre catégories sticky */}
      {categories.length > 1 && (
        <div
          className={`${surface} border-b ${border} sticky top-[72px] z-30`}
          style={{ borderColor: shop.theme.primaryColor + '15' }}
        >
          <div className="max-w-6xl mx-auto px-6 py-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <CategoryPill
                label="Tout"
                count={products.length}
                active={activeCategory === 'all'}
                onClick={() => setActiveCategory('all')}
                primary={shop.theme.primaryColor}
                isDark={isDark}
              />
              {categories.map(([cat, items]) => (
                <CategoryPill
                  key={cat}
                  label={cat}
                  count={items.length}
                  active={activeCategory === cat}
                  onClick={() => setActiveCategory(cat)}
                  primary={shop.theme.primaryColor}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8 pb-24">
        {shop.description && <p className={`${textSec} mb-8 max-w-3xl`}>{shop.description}</p>}

        {products.length === 0 ? (
          <p className={`${muted} italic`}>Aucun produit dans cette boutique pour l'instant.</p>
        ) : (
          visibleCategories.map(([cat, catProducts]) => (
            <section key={cat} className="mb-10">
              <h2
                className="text-lg font-bold uppercase tracking-wider mb-4 pb-2 border-b"
                style={{ borderColor: shop.theme.accentColor, color: titleColor }}
              >
                {cat}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {catProducts.map((p) => (
                  <div
                    key={p.id}
                    className={`${surface} border ${border} rounded-xl overflow-hidden flex flex-col`}
                  >
                    <ProductImage
                      src={p.image_url}
                      name={p.name}
                      category={p.category}
                      accentColor={shop.theme.primaryColor}
                      secondaryColor={shop.theme.accentColor}
                      className="w-full h-44"
                    />
                    <div className="p-4 flex-1 flex flex-col">
                      <button
                        onClick={() => setDetailProduct(p)}
                        className="font-semibold text-left hover:underline decoration-dotted underline-offset-4"
                      >
                        {p.name}
                      </button>
                      {p.description && (
                        <p className={`text-sm ${textSec} mt-1 line-clamp-2 flex-1`}>{p.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-bold text-lg" style={{ color: priceColor }}>
                          {p.price_ht.toFixed(2)} € HT
                        </span>
                        <button
                          onClick={() => addToCart(p)}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                          style={{ backgroundColor: shop.theme.primaryColor }}
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* JSON-LD : Product + FAQPage + BreadcrumbList quand la modale détail est ouverte */}
      {detailProduct && (() => {
        const enriched = enrichProduct(detailProduct.config || {}, pimGammes, pimDefinitions, 'fr');
        const shopUrl = `${window.location.origin}/shop/${shop.slug}`;
        const json = combineSchemas(
          productSchema(shop, detailProduct, enriched, shopUrl),
          faqSchema(enriched),
          breadcrumbSchema(shop, detailProduct, shopUrl)
        );
        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: json }}
          />
        );
      })()}

      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
          onClose={() => setDetailProduct(null)}
          onAdd={(qty) => {
            addToCart(detailProduct, qty);
            setDetailProduct(null);
          }}
          surface={surface}
          textPrim={textPrim}
          textSec={textSec}
          border={border}
          titleColor={titleColor}
          priceColor={priceColor}
          primary={shop.theme.primaryColor}
          accent={shop.theme.accentColor}
          isDark={isDark}
        />
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          totalHT={cartTotalHT}
          totalTTC={cartTotalTTC}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateQty}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
          surface={surface}
          textPrim={textPrim}
          textSec={textSec}
          border={border}
          primary={shop.theme.primaryColor}
          themeAccent={shop.theme.accentColor}
        />
      )}

      {/* Checkout */}
      {checkoutOpen && (
        <CheckoutModal
          shop={shop}
          cart={cart}
          totalHT={cartTotalHT}
          totalTTC={cartTotalTTC}
          onClose={() => setCheckoutOpen(false)}
          onDone={() => {
            setCart([]);
            setCheckoutOpen(false);
          }}
          primary={shop.theme.primaryColor}
        />
      )}
    </div>
  );
}

// ─── Category pill ───────────────────────────────────────────────────────────

function CategoryPill(props: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  primary: string;
  isDark: boolean;
}) {
  const { label, count, active, onClick, primary, isDark } = props;
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap border ${
        active
          ? 'text-white border-transparent'
          : isDark
          ? 'bg-gray-700/50 border-gray-600 text-gray-200 hover:bg-gray-700'
          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
      }`}
      style={active ? { backgroundColor: primary } : undefined}
    >
      {label}
      <span className={`ml-2 text-xs ${active ? 'opacity-80' : 'opacity-60'}`}>{count}</span>
    </button>
  );
}

// ─── Product detail modal (click sur le nom) ─────────────────────────────────

function ProductDetailModal(props: {
  product: ShopProduct;
  pimGammes: Gamme[];
  pimDefinitions: ProductDefinition[];
  onClose: () => void;
  onAdd: (qty: number) => void;
  surface: string;
  textPrim: string;
  textSec: string;
  border: string;
  titleColor: string;
  priceColor: string;
  primary: string;
  accent: string;
  isDark: boolean;
}) {
  const { product, pimGammes, pimDefinitions, onClose, onAdd, surface, textPrim, textSec, border, titleColor, priceColor, primary, isDark } = props;
  const [qty, setQty] = useState(1);
  const cfg = product.config || {};

  // Enrichissement PIM
  const enriched = useMemo(
    () => enrichProduct(cfg, pimGammes, pimDefinitions, 'fr'),
    [cfg, pimGammes, pimDefinitions]
  );

  const details: Array<[string, any]> = [
    ['Quantité produit', cfg.quantity],
    ['Format', cfg.format],
    ['Support', cfg.material],
    ['Grammage', cfg.weight ? `${cfg.weight} g/m²` : null],
    ['Impression recto', cfg.printing?.recto],
    ['Impression verso', cfg.printing?.verso],
    ['Finition recto', cfg.finishRecto || cfg.finish],
    ['Finition verso', cfg.finishVerso],
  ].filter(([, v]) => v != null && v !== '') as Array<[string, any]>;

  const totalHT = product.price_ht * qty;

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`${surface} ${textPrim} border ${border} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-4 border-b ${border} flex items-center justify-between`}>
          <h3 className="text-xl font-bold" style={{ color: titleColor }}>
            {product.name}
          </h3>
          <button onClick={onClose} className="p-1 hover:opacity-70">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ProductImage
            src={product.image_url}
            name={product.name}
            category={product.category}
            accentColor={primary}
            secondaryColor={props.accent}
            className="w-full h-56"
          />
          <div className="p-5 space-y-4">
            {product.description && <p className={`text-sm ${textSec}`}>{product.description}</p>}

            {/* Description enrichie PIM (si dispo) */}
            {enriched.resolved.description && (
              <div className={`text-sm ${textSec} whitespace-pre-line`}>
                {enriched.resolved.description}
              </div>
            )}

            {/* Exemples d'usage */}
            {enriched.resolved.usage_examples.length > 0 && (
              <div className={`border ${border} rounded-lg p-3`}>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: props.accent }}>
                  Cas d'usage
                </h4>
                <ul className="space-y-2">
                  {enriched.resolved.usage_examples.map((ex, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-semibold">{ex.title}</span>
                      {ex.description && <span className={textSec}> — {ex.description}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* FAQ */}
            {enriched.resolved.faq.length > 0 && (
              <div className={`border ${border} rounded-lg p-3`}>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: props.accent }}>
                  Questions fréquentes
                </h4>
                <div className="space-y-2">
                  {enriched.resolved.faq.map((qa, i) => (
                    <details key={i} className="text-sm">
                      <summary className="cursor-pointer font-medium">{qa.question}</summary>
                      <p className={`mt-1 pl-3 ${textSec}`}>{qa.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {details.length > 0 && (
              <div className={`border ${border} rounded-lg p-3 space-y-1.5 text-sm`}>
                {details.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span className={textSec}>{label}</span>
                    <span className="font-medium text-right">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={`border ${border} rounded-lg p-3 flex items-center justify-between`}>
              <label className="text-sm font-medium">Quantité à commander</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className={`w-8 h-8 rounded-lg border ${border} flex items-center justify-center hover:opacity-80`}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className={`w-20 text-center px-2 py-1.5 border ${border} rounded-lg ${
                    isDark ? 'bg-gray-900' : 'bg-white'
                  }`}
                />
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className={`w-8 h-8 rounded-lg border ${border} flex items-center justify-center hover:opacity-80`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className={`text-sm ${textSec}`}>Prix unitaire</span>
              <span className="font-semibold" style={{ color: priceColor }}>
                {product.price_ht.toFixed(2)} € HT
              </span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total HT ({qty})</span>
              <span style={{ color: priceColor }}>{totalHT.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <div className={`p-4 border-t ${border}`}>
          <button
            onClick={() => onAdd(qty)}
            className="w-full py-3 rounded-lg font-medium text-white"
            style={{ backgroundColor: primary }}
          >
            Ajouter au panier ({qty})
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cart drawer ─────────────────────────────────────────────────────────────

function CartDrawer(props: {
  cart: CartLine[];
  totalHT: number;
  totalTTC: number;
  onClose: () => void;
  onUpdateQty: (id: string, delta: number) => void;
  onCheckout: () => void;
  surface: string;
  textPrim: string;
  textSec: string;
  border: string;
  primary: string;
  themeAccent: string;
}) {
  const { cart, totalHT, totalTTC, onClose, onUpdateQty, onCheckout, surface, textPrim, textSec, border, primary, themeAccent } = props;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full max-w-md h-full ${surface} ${textPrim} shadow-2xl flex flex-col`}>
        <div className={`p-4 border-b ${border} flex items-center justify-between`}>
          <h3 className="font-bold text-lg">Votre panier</h3>
          <button onClick={onClose} className="p-1 hover:opacity-70">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <p className={`text-sm ${textSec}`}>Panier vide.</p>
          ) : (
            cart.map((l) => (
              <div key={l.product.id} className={`border ${border} rounded-lg p-3`}>
                <div className="flex items-start gap-3">
                  <ProductImage
                    src={l.product.image_url}
                    name={l.product.name}
                    category={l.product.category}
                    accentColor={themeAccent}
                    className="w-14 h-14 object-cover rounded shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.product.name}</p>
                    <p className={`text-xs ${textSec}`}>{l.product.price_ht.toFixed(2)} € HT × {l.qty}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => onUpdateQty(l.product.id, -1)}
                        className={`w-7 h-7 rounded border ${border} flex items-center justify-center`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{l.qty}</span>
                      <button
                        onClick={() => onUpdateQty(l.product.id, 1)}
                        className={`w-7 h-7 rounded border ${border} flex items-center justify-center`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold">{(l.product.price_ht * l.qty).toFixed(2)} €</p>
                </div>
              </div>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div className={`p-4 border-t ${border} space-y-3`}>
            <div className="flex justify-between text-sm">
              <span className={textSec}>Total HT</span>
              <span className="font-semibold">{totalHT.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={textSec}>TVA (20 %)</span>
              <span className="font-semibold">{(totalHT * 0.2).toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total TTC</span>
              <span>{totalTTC.toFixed(2)} €</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-3 rounded-lg font-medium text-white"
              style={{ backgroundColor: primary }}
            >
              Passer commande
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Checkout ────────────────────────────────────────────────────────────────

function CheckoutModal(props: {
  shop: Shop;
  cart: CartLine[];
  totalHT: number;
  totalTTC: number;
  onClose: () => void;
  onDone: () => void;
  primary: string;
}) {
  const { shop, cart, totalHT, totalTTC, onClose, onDone, primary } = props;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('shop_orders').insert({
      shop_id: shop.id,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      items: cart.map((l) => ({
        product_id: l.product.id,
        name: l.product.name,
        qty: l.qty,
        price_ht: l.product.price_ht,
      })),
      total_ht: totalHT,
      total_ttc: totalTTC,
      notes,
      status: 'pending',
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(onDone, 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 mb-3">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Commande enregistrée</h3>
            <p className="text-sm text-gray-600 mt-1">Vous allez recevoir une confirmation par email.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Finaliser la commande</h3>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span>Total TTC</span>
                  <span className="font-bold">{totalTTC.toFixed(2)} €</span>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full px-4 py-2.5 rounded-lg font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: primary }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Valider la commande
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
