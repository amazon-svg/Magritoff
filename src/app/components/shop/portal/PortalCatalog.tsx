import { useState, useMemo } from 'react';
import { Search, Sparkles, Plus, X, Loader2, AlertTriangle } from 'lucide-react';
import type { Shop, ShopProduct } from '../../../contexts/ShopsContext';
import type { Gamme, ProductDefinition } from '../../../utils/productEnrichment';
import { ProductMockup } from '../../brand/ProductMockup';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { fetchClariprintQuote } from '../../../utils/clariprintQuote';
import { TEST_IDS } from '../../../lib/testIds';
import { ShopProductCard } from '../ShopProductCard';
import { ProductOverlay } from '../ProductOverlay';

interface Props {
  shop: Shop;
  products: ShopProduct[];
  onSelectProduct: (p: ShopProduct) => void;
  onAddToCart: (p: ShopProduct, qty?: number) => void;
  pimGammes?: Gamme[];
  pimDefinitions?: ProductDefinition[];
}

// Convertit une config LLM (format claude-proxy : { clariprint, display }) en
// ShopProduct éphémère affichable dans la grille du catalogue.
function configToEphemeralShopProduct(config: any, index: number): ShopProduct {
  const d = config.display || {};
  const c = config.clariprint || {};
  const quantity = d.quantity ?? c.quantity ?? 0;
  const width = c.width;
  const height = c.height;
  return {
    id: `ai-${Date.now()}-${index}`,
    shop_id: '',
    product_id: null,
    name: d.productName || c.reference || 'Produit',
    category: (c.kind || 'Suggestion').toString(),
    description:
      d.format || (width && height ? `${width}×${height} cm` : '') +
      (d.support ? ` · ${d.support}` : '') +
      (d.grammage ? ` · ${d.grammage}g` : ''),
    price_ht: 0, // estimation cote portail : on laisse le detail a la fiche produit
    image_url: '',
    config: {
      ...c,
      ...d,
      clariprintData: c,
      quantity,
      format: d.format,
      material: d.support,
      weight: typeof d.grammage === 'number' ? d.grammage : parseInt(d.grammage) || undefined,
      printing: d.impression,
      finishRecto: d.finitionRecto,
      finishVerso: d.finitionVerso,
      pages: c.pages,
    } as any,
    display_order: index,
    created_at: new Date().toISOString(),
  } as ShopProduct;
}

// F2 — Catalogue recherche conversationnelle
// Design source : .design-handoff/designs/05 - Portail B2B.html (section .f2b)
export function PortalCatalog({
  shop,
  products,
  onSelectProduct,
  onAddToCart,
  pimGammes,
  pimDefinitions,
}: Props) {
  const [query, setQuery] = useState('');
  const [chips, setChips] = useState<string[]>([]);

  // S2.4 — Etat ProductOverlay (configuration produit Clariprint)
  const [overlayProduct, setOverlayProduct] = useState<ShopProduct | null>(null);

  // Resultats generes par Magrit (claude-proxy). Produits ephemeres qu'on peut
  // ajouter au panier meme s'ils n'existent pas dans le catalogue shop.
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<ShopProduct[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiQuery, setAiQuery] = useState(''); // query reellement envoyee

  const askMagrit = async () => {
    const prompt = query.trim();
    if (!prompt || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiResults([]);
    setAiQuery(prompt);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e3db71a4/claude-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const configs = Array.isArray(data?.configs) ? data.configs : [];
      if (configs.length === 0) {
        setAiError(
          data?.demoMode
            ? "Mode demo actif — l'API Claude n'est pas jointe depuis ce portail."
            : "Magrit n'a pas suggere de configuration. Essayez de reformuler."
        );
        return;
      }
      const initialProducts = configs.map(configToEphemeralShopProduct);
      setAiResults(initialProducts);

      // Appel Clariprint en parallele pour obtenir les prix reels
      // (chaque card affiche un skeleton prix tant qu'on attend).
      const withPrices = await Promise.all(
        initialProducts.map(async (p) => {
          const quote = await fetchClariprintQuote(p.config?.clariprintData ?? p.config);
          if (!quote.success || quote.priceHT == null) return p;
          return {
            ...p,
            price_ht: quote.priceHT,
            config: { ...p.config, clariprintQuote: quote },
          };
        })
      );
      setAiResults(withPrices);
    } catch (err: any) {
      setAiError(err?.message || 'Erreur lors de l\'appel à Magrit.');
    } finally {
      setAiLoading(false);
    }
  };

  // Categories calculees depuis les produits
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return Array.from(set);
  }, [products]);

  // Filtre simple par query + chips
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (chips.length > 0 && p.category && !chips.includes(p.category)) {
        // chips agissent comme filtres additifs : le produit doit matcher au moins
        // une des chips actives (sinon il est exclu quand il y a des chips).
        const matchAny = chips.some((c) => p.category?.toLowerCase().includes(c.toLowerCase()));
        if (!matchAny) return false;
      }
      if (!q) return true;
      const hay = `${p.name} ${p.description ?? ''} ${p.category ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, query, chips]);

  const suggestions = [
    'flyers événement 500 ex.',
    'cartes de visite premium',
    'refaire ma dernière commande',
    'packaging RSE',
  ];

  const addChip = (c: string) => {
    if (!chips.includes(c)) setChips([...chips, c]);
  };
  const removeChip = (c: string) => setChips(chips.filter((x) => x !== c));

  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>
      {/* Hero search conversationnel */}
      <div className="px-12 py-11 bg-paper border-b border-line">
        <div
          className="font-mono uppercase text-ink-mute-2 mb-3.5"
          style={{ fontSize: '11px', letterSpacing: '0.08em', fontWeight: 500 }}
        >
          Catalogue négocié · {products.length} produit{products.length > 1 ? 's' : ''}
        </div>
        <h3
          className="text-ink m-0 mb-5.5"
          style={{
            fontSize: '35px',
            fontWeight: 400,
            letterSpacing: '-0.025em',
            marginBottom: '22px',
          }}
        >
          Qu'est-ce que vous cherchez&nbsp;?
        </h3>

        {/* Barre de recherche */}
        <div
          className="flex items-center gap-3 px-4.5 py-4 bg-paper border border-line-2 rounded-xl max-w-[920px]"
          style={{ boxShadow: 'var(--v2-shadow-md)' }}
        >
          <Search className="w-[18px] h-[18px] text-ink-mute-2 shrink-0" strokeWidth={1.5} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                askMagrit();
              }
            }}
            placeholder="cartes de visite pour l'équipe direction, papier premium, livrées avant fin de mois"
            className="flex-1 bg-transparent border-0 focus:outline-none text-ink placeholder:text-ink-mute-2"
            style={{ fontSize: '15px', fontWeight: 400, letterSpacing: '-0.005em' }}
          />
          <button
            onClick={askMagrit}
            disabled={aiLoading || !query.trim()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-ink text-paper hover:bg-black shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            {aiLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />}
            Demander à Magrit
            <span
              className="font-mono opacity-70 px-1.5 py-0.5 rounded bg-white/10"
              style={{ fontSize: '10.5px', fontWeight: 500 }}
            >
              ↵
            </span>
          </button>
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap items-center gap-2 mt-4 max-w-[920px]">
          <span
            className="font-mono uppercase text-ink-mute-2 mr-1"
            style={{ fontSize: '11px', letterSpacing: '0.06em', fontWeight: 500 }}
          >
            Suggestions
          </span>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setQuery(s)}
              className="px-3 py-1.5 bg-paper border border-line rounded-full text-ink-2 hover:bg-bg hover:border-line-2"
              style={{ fontSize: '12.5px', fontWeight: 400 }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Chips filtres IA */}
      <div className="flex flex-wrap items-center gap-2 px-12 py-4 bg-bg border-b border-line">
        <span
          className="inline-flex items-center gap-1.5 font-mono uppercase text-ink-muted mr-1.5"
          style={{ fontSize: '11px', letterSpacing: '0.06em', fontWeight: 500 }}
        >
          <Sparkles className="w-3.5 h-3.5 text-brand" strokeWidth={1.5} />
          Compris par Magrit
        </span>
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => removeChip(c)}
            className="inline-flex items-center gap-2 px-3 py-1 pl-3 bg-paper border border-line-2 rounded-full text-ink hover:border-line"
            style={{ fontSize: '12.5px', fontWeight: 400 }}
          >
            {c}
            <span className="pl-1 border-l border-line text-ink-mute-2">
              <X className="w-3 h-3" strokeWidth={1.5} />
            </span>
          </button>
        ))}
        {categories.length > 0 && chips.length < categories.length && (
          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addChip(e.target.value);
                  e.target.value = '';
                }
              }}
              className="appearance-none pl-3 pr-8 py-1 bg-transparent border border-dashed border-line-2 rounded-full text-ink-muted cursor-pointer hover:text-ink"
              style={{ fontSize: '12.5px', fontWeight: 400 }}
              defaultValue=""
            >
              <option value="" disabled>
                + Ajouter un critère
              </option>
              {categories.filter((c) => !chips.includes(c)).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Plus
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-muted pointer-events-none"
              strokeWidth={1.5}
            />
          </div>
        )}
        <div
          className="ml-auto text-ink-muted"
          style={{ fontSize: '12.5px', fontWeight: 400 }}
        >
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''} ·{' '}
          <span className="text-ink" style={{ fontWeight: 500 }}>
            Recommandés
          </span>
        </div>
      </div>

      {/* Grille 4-col — S2.3 ShopProductCard avec MockupImage parametrique */}
      <div data-testid={TEST_IDS.shop.productGrid} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-12 py-8 bg-paper">
        {filtered.length === 0 ? (
          <div
            className="col-span-full text-center py-16 text-ink-muted"
            style={{ fontSize: '14px', fontWeight: 400 }}
          >
            Aucun produit ne correspond à cette recherche.
          </div>
        ) : (
          filtered.map((p) => (
            <ShopProductCard
              key={p.id}
              product={p}
              shop={shop}
              onCardClick={onSelectProduct}
              onAddToCart={onAddToCart}
              onConfigure={(prod) => setOverlayProduct(prod)}
            />
          ))
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          Section "Suggéré par Magrit" — appel à claude-proxy
          Affichee sous la grille quand on a des resultats AI ou un loading/error.
          ══════════════════════════════════════════════════════════ */}
      {(aiLoading || aiError || aiResults.length > 0) && (
        <div className="px-12 py-8 bg-bg border-t border-line">
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles className="w-4 h-4 text-brand" strokeWidth={1.5} />
            <h4
              className="text-ink m-0"
              style={{ fontSize: '18px', fontWeight: 500, letterSpacing: '-0.015em' }}
            >
              Suggéré par Magrit
            </h4>
            {aiQuery && (
              <span
                className="text-ink-muted ml-1"
                style={{ fontSize: '13px', fontWeight: 400 }}
              >
                pour « {aiQuery} »
              </span>
            )}
            {!aiLoading && aiResults.length > 0 && (
              <span
                className="ml-auto font-mono text-ink-muted"
                style={{ fontSize: '11px', letterSpacing: '0.04em', fontWeight: 500 }}
              >
                {aiResults.length} PROPOSITION{aiResults.length > 1 ? 'S' : ''}
              </span>
            )}
          </div>

          {aiLoading && (
            <div className="flex items-center gap-3 text-ink-muted">
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              <span style={{ fontSize: '13.5px', fontWeight: 400 }}>
                Magrit compose les configurations les plus adaptées…
              </span>
            </div>
          )}

          {aiError && !aiLoading && (
            <div
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-warn-bg border border-warn-fg/20 text-warn-fg"
              style={{ fontSize: '13px', fontWeight: 400 }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              {aiError}
            </div>
          )}

          {!aiLoading && aiResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-1">
              {aiResults.map((p) => (
                <article
                  key={p.id}
                  className="group bg-paper border border-line rounded-lg overflow-hidden cursor-pointer hover:border-line-2 transition-colors"
                  onClick={() => onSelectProduct(p)}
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-t-lg">
                    <ProductMockup
                      name={p.name}
                      kind={(p.config as any)?.kind}
                      category={p.category}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-brand" strokeWidth={1.5} />
                      <span
                        className="font-mono uppercase text-brand"
                        style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
                      >
                        Suggestion
                      </span>
                    </div>
                    <h4
                      className="text-ink m-0"
                      style={{ fontSize: '14.5px', fontWeight: 500, letterSpacing: '-0.005em', lineHeight: 1.35 }}
                    >
                      {p.name}
                    </h4>
                    {p.description && (
                      <p
                        className="text-ink-muted m-0 line-clamp-2"
                        style={{ fontSize: '12.5px', fontWeight: 400, lineHeight: 1.5 }}
                      >
                        {p.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      {p.price_ht > 0 ? (
                        <div
                          className="font-mono text-ink"
                          style={{ fontSize: '16px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {p.price_ht.toFixed(0)}
                          <span className="text-ink-muted ml-1" style={{ fontSize: '12px' }}>
                            €
                          </span>
                          <span
                            className="text-ink-muted ml-1.5"
                            style={{ fontSize: '11.5px', fontWeight: 400 }}
                          >
                            / {(p.config as any)?.quantity ?? 500} ex.
                          </span>
                        </div>
                      ) : aiLoading ? (
                        <span
                          className="font-mono text-ink-mute-2 inline-flex items-center gap-1.5"
                          style={{ fontSize: '11.5px', fontWeight: 400 }}
                        >
                          <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                          Calcul Clariprint…
                        </span>
                      ) : (
                        <span
                          className="font-mono text-ink-muted"
                          style={{ fontSize: '11.5px', fontWeight: 400 }}
                        >
                          Prix à calculer
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProduct(p);
                        }}
                        className="px-3 py-1.5 bg-ink text-paper rounded-md hover:bg-black"
                        style={{ fontSize: '12.5px', fontWeight: 500 }}
                      >
                        Configurer
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* S2.4 — Overlay configuration produit Clariprint */}
      <ProductOverlay
        product={overlayProduct}
        shop={shop}
        onClose={() => setOverlayProduct(null)}
        onAddToCart={(productConfigured, qty) => {
          onAddToCart(productConfigured, qty);
          setOverlayProduct(null);
        }}
      />
    </div>
  );
}
