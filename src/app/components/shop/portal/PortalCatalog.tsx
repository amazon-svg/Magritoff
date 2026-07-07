import { lazy, Suspense, useEffect, useState, useMemo } from 'react';
import { Search, Sparkles, Plus, X, Loader2, AlertTriangle } from 'lucide-react';
import type { Shop, ShopProduct } from '../../../contexts/ShopsContext';
import type { Gamme, ProductDefinition } from '../../../utils/productEnrichment';
import { resolveProductImage } from '../../../utils/productImages';
import { supabase } from '/utils/supabase/client';
import { computeClariprintQuoteSafe } from '../../../../server/clariprint/ClariprintAdapter';
import { TEST_IDS } from '../../../lib/testIds';
import { ShopProductCard } from '../ShopProductCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import {
  DEFAULT_SORT_KEY,
  filterProductsByTextQuery,
  loadSortKey,
  saveSortKey,
  SORT_OPTIONS,
  sortProductsBy,
  type SortKey,
} from './PortalCatalog.helpers';

// R7 (refacto 2026-05-11) : lazy-load le ProductOverlay (configurateur lourd
// charge seulement quand l'acheteur clique "Configurer").
const ProductOverlay = lazy(() =>
  import('../ProductOverlay').then((m) => ({ default: m.ProductOverlay })),
);

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
    // ADR-4.17 : gamme explicite renvoyee par le LLM (display.gamme) -> le badge,
    // le repere famille et le filtrage restent coherents pour les resultats IA.
    gamme_slug: (d.gamme as string | undefined) ?? null,
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

  // S-CONSO-4 (Sprint 4 Phase 2, Sally) : mode recherche pour resilience IA.
  // 'ia' = claude-proxy a repondu < 3s. 'text' = fallback automatique sur
  // filter local (claude-proxy timeout / billing / down).
  const [searchMode, setSearchMode] = useState<'ia' | 'text'>('ia');

  // S-CONSO-5 (Sprint 4 Phase 2, Sally) : tri grille catalogue avec
  // persistance localStorage par slug. Sort key chargee au mount.
  const [sortKey, setSortKey] = useState<SortKey>(() => loadSortKey(shop.slug));
  useEffect(() => {
    saveSortKey(shop.slug, sortKey);
  }, [shop.slug, sortKey]);

  const askMagrit = async () => {
    const prompt = query.trim();
    if (!prompt || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiResults([]);
    setAiQuery(prompt);
    try {
      // S-CONSO-4 (Sprint 4 Phase 2, Sally) : timeout sur claude-proxy.
      // Au-dela, fallback automatique sur filter local (mode 'text').
      // Race entre invoke + timeout pour permettre le bascule rapide.
      // Note 2026-05-20 : 3s -> 15s. Claude Sonnet 4.5 repond en 5-15s en
      // nominal (mesure curl direct 9.7s). 3s tombait en timeout systematique.
      const CLAUDE_PROXY_TIMEOUT_MS = 15_000;
      const invokePromise = supabase.functions.invoke(
        'make-server-e3db71a4/claude-proxy',
        { body: { messages: [{ role: 'user', content: prompt }] } },
      );
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('claude_proxy_timeout')), CLAUDE_PROXY_TIMEOUT_MS);
      });
      const { data, error } = (await Promise.race([invokePromise, timeoutPromise])) as Awaited<
        typeof invokePromise
      >;
      if (error) throw new Error(error.message || 'Erreur Claude proxy');
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
          const quote = await computeClariprintQuoteSafe(p.config?.clariprintData ?? p.config);
          if (!quote.success || quote.priceHT == null) return p;
          return {
            ...p,
            price_ht: quote.priceHT,
            config: { ...p.config, clariprintQuote: quote },
          };
        })
      );
      setAiResults(withPrices);
      setSearchMode('ia'); // S-CONSO-4 : reussite -> mode IA
    } catch (err: any) {
      // S-CONSO-4 : fallback automatique sur filter local (mode 'text').
      // Le filtered useMemo en aval matche query sur name/description/gamme.
      const isTimeout = err?.message === 'claude_proxy_timeout_3s';
      console.info(
        `[claude_proxy_fallback] ${new Date().toISOString()} ${isTimeout ? 'timeout 3s' : 'error'} — query="${prompt}"`,
      );
      setSearchMode('text');
      // Pas d aiError affiche : le filter local prend le relais. On efface
      // les aiResults pour ne pas afficher de section AI vide.
      setAiError(null);
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

  // Filtre simple par query + chips, puis tri (S-CONSO-4 + S-CONSO-5).
  // L ordre est : filterByText -> chips -> sort. Sally : composabilité.
  const filtered = useMemo(() => {
    // S-CONSO-4 : utilise le helper partage filterProductsByTextQuery
    // (match sur name + description + gamme.name, pas kind technique).
    let result = filterProductsByTextQuery(products, query, pimGammes ?? []);
    if (chips.length > 0) {
      result = result.filter((p) => {
        if (!p.category) return false;
        return chips.some((c) => p.category?.toLowerCase().includes(c.toLowerCase()));
      });
    }
    // S-CONSO-5 : tri grille selon sortKey persiste localStorage.
    return sortProductsBy(result, sortKey);
  }, [products, query, chips, pimGammes, sortKey]);

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
        {/* S-CONSO-4 (Sally) : badge mode discret IA / texte (resilience claude-proxy down) */}
        {(aiQuery || query) && (
          <span
            aria-live="polite"
            className={`font-mono uppercase px-2 py-0.5 rounded ${
              searchMode === 'ia'
                ? 'bg-ok-bg text-ok-fg'
                : 'bg-bg text-ink-mute-2 border border-line'
            }`}
            style={{ fontSize: '10px', letterSpacing: '0.06em', fontWeight: 500 }}
            title={
              searchMode === 'ia'
                ? "Recherche enrichie par l'IA Magrit"
                : 'Recherche simplifiée (IA indisponible) — fallback texte automatique'
            }
          >
            Mode {searchMode === 'ia' ? 'IA' : 'texte'}
          </span>
        )}

        <div
          className="ml-auto text-ink-muted flex items-center gap-3"
          style={{ fontSize: '12.5px', fontWeight: 400 }}
        >
          <span aria-live="polite">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </span>

          {/* S-CONSO-5 (Sally) : Select tri grille catalogue + reset si non-default */}
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger
              className="w-44 h-8 text-xs"
              aria-label="Trier les produits"
              data-testid={TEST_IDS.shop.catalogSortSelect}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sortKey !== DEFAULT_SORT_KEY && (
            <button
              onClick={() => setSortKey(DEFAULT_SORT_KEY)}
              className="text-ink-muted hover:text-ink underline"
              style={{ fontSize: '11px' }}
            >
              Réinitialiser
            </button>
          )}
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
              pimGammes={pimGammes}
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
                  {/* P18 v2 (2026-06-24) — Visuel produit pré-brandé Magrit
                      (image curée produit/PIM si definie, sinon visuel Gemini de
                      la famille). Aligne les suggestions IA sur le catalogue. */}
                  <div
                    className="aspect-[4/3] overflow-hidden rounded-t-lg"
                    style={{ background: '#F5F5F5' }}
                  >
                    <img
                      src={resolveProductImage({
                        name: p.name,
                        id: p.id,
                        image_url: p.image_url,
                        kind: (p.config as Record<string, unknown> | undefined)?.kind as
                          | string
                          | undefined,
                        clariprintData: p.config,
                        category: p.category,
                        gammes: pimGammes,
                        definitions: pimDefinitions,
                      })}
                      alt={`Visuel ${p.name}`}
                      loading="lazy"
                      className="w-full h-full object-contain"
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

      {/* S2.4 — Overlay configuration produit Clariprint (R7 lazy) */}
      {overlayProduct && (
        <Suspense fallback={null}>
          <ProductOverlay
            product={overlayProduct}
            shop={shop}
            onClose={() => setOverlayProduct(null)}
            onConfirm={(productConfigured, qty) => {
              // S-FIX-PANIER-11/05 (bug #5) : `qty` retourne par l'overlay est la
              // quantite d'exemplaires. On la stocke dans config.quantity et on
              // passe `1 pack` au panier pour que `price_ht * cart.qty` reste
              // egal au prix forfaitaire du pack (pas multiplie par les ex).
              const withQty = {
                ...productConfigured,
                config: { ...(productConfigured.config ?? {}), quantity: qty },
              };
              onAddToCart(withQty, 1);
              setOverlayProduct(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
