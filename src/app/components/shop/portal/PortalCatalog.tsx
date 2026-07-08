import { lazy, Suspense, useEffect, useState, useMemo } from 'react';
import { Search, Sparkles, X, Loader2, AlertTriangle } from 'lucide-react';
import type { Shop, ShopProduct } from '../../../contexts/ShopsContext';
import type { Gamme, ProductDefinition } from '../../../utils/productEnrichment';
import { resolveProductImage } from '../../../utils/productImages';
import { supabase } from '/utils/supabase/client';
import { computeClariprintQuoteSafe } from '../../../../server/clariprint/ClariprintAdapter';
import { TEST_IDS } from '../../../lib/testIds';
import { ShopProductCard } from '../ShopProductCard';
import { buildShopTaxonomy } from '../../../utils/shopTaxonomy';
import {
  deriveFormatFacets,
  derivePriceFacets,
  applyFacets,
  hasActiveFacets,
} from '../../../utils/catalogFacets';
import {
  buildSearchSuggestions,
  hasNoMatch,
  type SearchSuggestion,
} from '../../../utils/catalogSearch';
import {
  buildCategoryLandingModel,
  mergeEditorial,
  categoryEditorialCacheKey,
  type CategoryEditorial,
} from '../../../utils/catalogLanding';
import { PortalCategoryLanding } from './PortalCategoryLanding';
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
  /** S2.19 — fil d'Ariane : « Accueil » ramène à la home boutique. */
  onGoHome?: () => void;
  /** S2.21 — index de recherche = catalogue complet (transcende le filtre gamme actif). */
  searchIndex?: ShopProduct[];
  /** S2.21 — clic sur une suggestion famille → filtre le catalogue (réutilise selectGammes). */
  onSelectFamily?: (gammeSlugs: string[]) => void;
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
  onGoHome,
  pimGammes,
  pimDefinitions,
  searchIndex,
  onSelectFamily,
}: Props) {
  const [query, setQuery] = useState('');
  // S2.21 — autocomplétion : menu ouvert au focus + saisie ≥ 2 car.
  const [searchOpen, setSearchOpen] = useState(false);
  // S2.19 — facettes légères : format (multi) + tranche de prix (single).
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set());
  const [priceKey, setPriceKey] = useState<string | null>(null);

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
      // Note 2026-07-08 : 15s -> 45s. Les requetes larges/multi-produits (ex.
      // "produits pour organiser un evenement sportif 15 equipes") prennent
      // 30s+ (mesure curl reelle 30.9s -> 5 configs valides). A 15s on coupait
      // AVANT la reponse, bascule mode texte, filtre local muet sur une phrase
      // en langage naturel = ecran sans reponse cote boutique alors que la home
      // Magrit (streamee, sans coupure) repondait. Le spinner reste affiche.
      const CLAUDE_PROXY_TIMEOUT_MS = 45_000;
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

  // S2.19 — Facettes dérivées des produits (format + prix), data-driven.
  const formatFacets = useMemo(() => deriveFormatFacets(products), [products]);
  const priceFacets = useMemo(() => derivePriceFacets(products), [products]);
  const facetSelection = useMemo(
    () => ({ formats: selectedFormats, price: priceKey }),
    [selectedFormats, priceKey],
  );

  // S2.19/S2.20 — Famille active : si les produits (déjà filtrés en amont par
  // gamme) appartiennent tous à une seule famille, on tient l'objet complet
  // (fil d'Ariane + landing éditorialisée).
  const activeFamily = useMemo(() => {
    const tax = buildShopTaxonomy(products, pimGammes ?? []);
    const withProducts = tax.filter((f) => f.count > 0);
    return withProducts.length === 1 ? withProducts[0] : null;
  }, [products, pimGammes]);
  const breadcrumbFamily = activeFamily?.label ?? null;

  // S2.20 — Contenu éditorial LLM (endpoint category-editorial), avec cache
  // session par famille + socle déterministe si l'IA est indisponible.
  const [editorial, setEditorial] = useState<CategoryEditorial | null>(null);
  useEffect(() => {
    if (!activeFamily) {
      setEditorial(null);
      return;
    }
    let cancelled = false;
    const cacheKey = categoryEditorialCacheKey(activeFamily.key);
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setEditorial(JSON.parse(cached));
        return;
      }
    } catch {
      /* sessionStorage indispo : on tente l'appel réseau */
    }
    setEditorial(null);
    (async () => {
      try {
        const CATEGORY_EDITORIAL_TIMEOUT_MS = 12_000;
        const invokePromise = supabase.functions.invoke(
          'make-server-e3db71a4/category-editorial',
          {
            body: {
              familyName: activeFamily.label,
              subcategories: activeFamily.subcategories.filter((s) => s.count > 0).map((s) => s.label),
              sampleProducts: products.slice(0, 8).map((p) => p.name),
            },
          },
        );
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('category_editorial_timeout')), CATEGORY_EDITORIAL_TIMEOUT_MS);
        });
        const { data } = (await Promise.race([invokePromise, timeoutPromise])) as Awaited<
          typeof invokePromise
        >;
        const ed = (data?.editorial ?? {}) as CategoryEditorial;
        if (cancelled) return;
        setEditorial(ed);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(ed));
        } catch {
          /* noop */
        }
      } catch {
        // Timeout / réseau : on garde le socle déterministe (jamais de page vide).
        if (!cancelled) setEditorial(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeFamily, products]);

  // S2.20 — Modèle final de la landing : socle déterministe + overlay éditorial.
  const landingModel = useMemo(
    () => (activeFamily ? mergeEditorial(buildCategoryLandingModel(activeFamily, products), editorial) : null),
    [activeFamily, products, editorial],
  );

  // Filtre : texte -> facettes (format/prix) -> tri (S-CONSO-4 + S-CONSO-5 + S2.19).
  const filtered = useMemo(() => {
    let result = filterProductsByTextQuery(products, query, pimGammes ?? []);
    result = applyFacets(result, facetSelection);
    return sortProductsBy(result, sortKey);
  }, [products, query, facetSelection, pimGammes, sortKey]);

  // S2.21 — Autocomplétion : index = catalogue complet (transcende le filtre
  // gamme actif), fallback sur les produits affichés si searchIndex absent.
  const searchSource = searchIndex ?? products;
  const suggestions = useMemo(
    () => buildSearchSuggestions(query, searchSource, pimGammes ?? []),
    [query, searchSource, pimGammes],
  );
  const showSearchMenu = searchOpen && query.trim().length >= 2;
  const noMatch = hasNoMatch(query, suggestions);

  const handleSelectSuggestion = (s: SearchSuggestion) => {
    setSearchOpen(false);
    if (s.type === 'product') {
      onSelectProduct(s.product);
    } else if (onSelectFamily) {
      onSelectFamily(s.gammeSlugs);
    } else {
      // Dégradé gracieux (pas de nav famille câblée) : bascule en filtre texte.
      setQuery(s.label);
    }
  };

  const askMagritFromMenu = () => {
    setSearchOpen(false);
    askMagrit();
  };

  const toggleFormat = (key: string) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const resetFacets = () => {
    setSelectedFormats(new Set());
    setPriceKey(null);
  };

  const heroSuggestions = [
    'flyers événement 500 ex.',
    'cartes de visite premium',
    'refaire ma dernière commande',
    'packaging RSE',
  ];

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

        {/* Barre de recherche + autocomplétion (S2.21) */}
        <div className="relative max-w-[920px]">
          <div
            className="flex items-center gap-3 px-4.5 py-4 bg-paper border border-line-2 rounded-xl"
            style={{ boxShadow: 'var(--v2-shadow-md)' }}
          >
            <Search className="w-[18px] h-[18px] text-ink-mute-2 shrink-0" strokeWidth={1.5} />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              // Délai : laisse le clic (onMouseDown) sur une option se déclencher avant la fermeture.
              onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchOpen(false);
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  setSearchOpen(false);
                  askMagrit();
                }
              }}
              role="combobox"
              aria-expanded={showSearchMenu}
              aria-controls={TEST_IDS.shop.catalogSearchMenu}
              aria-autocomplete="list"
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

          {/* Menu autocomplétion : familles puis produits, sinon fallback Magrit */}
          {showSearchMenu && (
            <div
              data-testid={TEST_IDS.shop.catalogSearchMenu}
              role="listbox"
              aria-label="Suggestions de recherche"
              className="absolute z-30 left-0 right-0 mt-1.5 bg-paper border border-line-2 rounded-xl overflow-hidden"
              style={{ boxShadow: 'var(--v2-shadow-md)' }}
            >
              {suggestions.map((s) => (
                <button
                  key={s.type === 'product' ? `p-${s.id}` : `f-${s.key}`}
                  data-testid={TEST_IDS.shop.catalogSearchOption}
                  role="option"
                  aria-selected={false}
                  // onMouseDown (pas onClick) : se déclenche avant le onBlur de l'input.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(s);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-bg border-b border-line last:border-b-0"
                >
                  {s.type === 'family' ? (
                    <span
                      className="font-mono uppercase shrink-0 px-1.5 py-0.5 rounded bg-bg text-ink-muted"
                      style={{ fontSize: '9.5px', letterSpacing: '0.05em' }}
                    >
                      Famille
                    </span>
                  ) : (
                    <Search className="w-3.5 h-3.5 text-ink-mute-2 shrink-0" strokeWidth={1.5} />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-ink truncate" style={{ fontSize: '13.5px' }}>
                      {s.label}
                    </span>
                    {s.type === 'product' && s.sublabel && (
                      <span className="block text-ink-mute-2 truncate" style={{ fontSize: '11.5px' }}>
                        {s.sublabel}
                      </span>
                    )}
                  </span>
                  {s.type === 'family' && (
                    <span className="font-mono text-ink-mute-2 shrink-0" style={{ fontSize: '11px' }}>
                      {s.count} produit{s.count > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              ))}

              {/* Fallback : aucune correspondance locale → Demander à Magrit (ADR §4.15) */}
              {noMatch && (
                <button
                  data-testid={TEST_IDS.shop.catalogSearchAskMagrit}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    askMagritFromMenu();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-bg"
                >
                  <Sparkles className="w-4 h-4 text-ink shrink-0" strokeWidth={1.5} />
                  <span className="flex-1 text-ink" style={{ fontSize: '13.5px' }}>
                    Aucun résultat — demander à Magrit « <span style={{ fontWeight: 500 }}>{query.trim()}</span> »
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap items-center gap-2 mt-4 max-w-[920px]">
          <span
            className="font-mono uppercase text-ink-mute-2 mr-1"
            style={{ fontSize: '11px', letterSpacing: '0.06em', fontWeight: 500 }}
          >
            Suggestions
          </span>
          {heroSuggestions.map((s) => (
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

      {/* S2.20 — Landing éditorialisée quand une seule famille est active */}
      {landingModel && activeFamily && (
        <PortalCategoryLanding
          model={landingModel}
          tone={activeFamily.tone}
          onSelectSubcategory={(slugs) => {
            if (onSelectFamily) onSelectFamily(slugs);
          }}
          onSelectProduct={onSelectProduct}
          pimGammes={pimGammes}
          pimDefinitions={pimDefinitions}
        />
      )}

      {/* S2.19 — Fil d'Ariane : Accueil > Catalogue [> Famille] */}
      <nav
        data-testid={TEST_IDS.shop.catalogBreadcrumb}
        aria-label="Fil d'Ariane"
        className="flex items-center gap-1.5 px-12 py-2.5 bg-bg border-b border-line text-ink-muted"
        style={{ fontSize: '12px' }}
      >
        <button onClick={() => onGoHome?.()} className="hover:text-ink hover:underline">
          Accueil
        </button>
        <span className="text-ink-mute-2">›</span>
        <span className={breadcrumbFamily ? '' : 'text-ink'}>Catalogue</span>
        {breadcrumbFamily && (
          <>
            <span className="text-ink-mute-2">›</span>
            <span className="text-ink" style={{ fontWeight: 500 }}>{breadcrumbFamily}</span>
          </>
        )}
      </nav>

      {/* S2.19 — Facettes légères : Format (filtre) + Prix. Le format est un
          FILTRE, pas une catégorie (ADR-4.17). + badge mode IA + tri. */}
      <div className="flex flex-wrap items-center gap-2 px-12 py-4 bg-bg border-b border-line">
        {formatFacets.length > 1 && (
          <div className="inline-flex items-center gap-1.5" data-testid={TEST_IDS.shop.catalogFacetFormat}>
            <span className="font-mono uppercase text-ink-muted mr-0.5" style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}>Format</span>
            {formatFacets.map((f) => {
              const active = selectedFormats.has(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => toggleFormat(f.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${active ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-2 border-line-2 hover:border-line'}`}
                  style={{ fontSize: '12px', fontWeight: 400 }}
                >
                  {f.label}
                  <span className={`font-mono ${active ? 'text-paper/70' : 'text-ink-mute-2'}`} style={{ fontSize: '10px' }}>{f.count}</span>
                </button>
              );
            })}
          </div>
        )}
        {priceFacets.length > 1 && (
          <div className="inline-flex items-center gap-1.5 ml-1" data-testid={TEST_IDS.shop.catalogFacetPrice}>
            <span className="font-mono uppercase text-ink-muted mr-0.5" style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}>Prix</span>
            {priceFacets.map((f) => {
              const active = priceKey === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setPriceKey(active ? null : f.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${active ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-2 border-line-2 hover:border-line'}`}
                  style={{ fontSize: '12px', fontWeight: 400 }}
                >
                  {f.label}
                  <span className={`font-mono ${active ? 'text-paper/70' : 'text-ink-mute-2'}`} style={{ fontSize: '10px' }}>{f.count}</span>
                </button>
              );
            })}
          </div>
        )}
        {hasActiveFacets(facetSelection) && (
          <button
            data-testid={TEST_IDS.shop.catalogResetFacets}
            onClick={resetFacets}
            className="inline-flex items-center gap-1 text-ink-muted hover:text-ink underline"
            style={{ fontSize: '11.5px' }}
          >
            <X className="w-3 h-3" strokeWidth={1.5} /> Réinitialiser
          </button>
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
            data-testid={TEST_IDS.shop.catalogEmpty}
            className="col-span-full text-center py-16"
          >
            <p className="text-ink-muted m-0 mb-4" style={{ fontSize: '14px', fontWeight: 400 }}>
              Aucun produit ne correspond{hasActiveFacets(facetSelection) ? ' à ces filtres' : ' à cette recherche'}.
            </p>
            <div className="flex items-center justify-center gap-3">
              {hasActiveFacets(facetSelection) && (
                <button
                  onClick={resetFacets}
                  className="px-3.5 py-2 rounded-md border border-line bg-paper text-ink-2 hover:bg-bg hover:text-ink"
                  style={{ fontSize: '12.5px', fontWeight: 500 }}
                >
                  Réinitialiser les filtres
                </button>
              )}
              <button
                data-testid={TEST_IDS.shop.catalogEmptyAskMagrit}
                onClick={() => askMagrit()}
                disabled={aiLoading}
                className="px-3.5 py-2 rounded-md bg-ink text-paper hover:bg-ink-2 inline-flex items-center gap-1.5 disabled:opacity-60"
                style={{ fontSize: '12.5px', fontWeight: 500 }}
              >
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} /> Demander à Magrit
              </button>
            </div>
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
