import { useState, useMemo } from 'react';
import { Search, Sparkles, Plus, X } from 'lucide-react';
import type { ShopProduct } from '../../../contexts/ShopsContext';
import { resolveProductImage } from '../../../utils/productImages';

interface Props {
  products: ShopProduct[];
  onSelectProduct: (p: ShopProduct) => void;
  onAddToCart: (p: ShopProduct, qty?: number) => void;
}

// F2 — Catalogue recherche conversationnelle
// Design source : .design-handoff/designs/05 - Portail B2B.html (section .f2b)
export function PortalCatalog({ products, onSelectProduct, onAddToCart }: Props) {
  const [query, setQuery] = useState('');
  const [chips, setChips] = useState<string[]>([]);

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
            placeholder="cartes de visite pour l'équipe direction, papier premium, livrées avant fin de mois"
            className="flex-1 bg-transparent border-0 focus:outline-none text-ink placeholder:text-ink-mute-2"
            style={{ fontSize: '15px', fontWeight: 400, letterSpacing: '-0.005em' }}
          />
          <button
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-ink text-paper hover:bg-black shrink-0"
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
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

      {/* Grille 4-col */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-12 py-8 bg-paper">
        {filtered.length === 0 ? (
          <div
            className="col-span-full text-center py-16 text-ink-muted"
            style={{ fontSize: '14px', fontWeight: 400 }}
          >
            Aucun produit ne correspond à cette recherche.
          </div>
        ) : (
          filtered.map((p) => {
            const imgSrc = resolveProductImage({
              name: p.name,
              id: p.id,
              image_url: p.image_url,
              kind: (p.config as any)?.kind,
            });
            return (
              <article
                key={p.id}
                className="group bg-paper border border-transparent rounded-lg overflow-hidden cursor-pointer hover:border-line transition-colors"
                onClick={() => onSelectProduct(p)}
              >
                <div
                  className="aspect-[4/3] overflow-hidden rounded-lg relative"
                  style={{ background: '#F5F5F5' }}
                >
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-bg to-line" />
                  )}
                  <span
                    className="absolute top-2.5 left-2.5 font-mono uppercase px-2 py-1 rounded bg-ink text-paper"
                    style={{ fontSize: '10px', letterSpacing: '0.08em', fontWeight: 500 }}
                  >
                    {p.category || 'Template'}
                  </span>
                </div>

                <div className="p-3 flex flex-col gap-2">
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
                        / 500 ex.
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(p, 1);
                      }}
                      className="opacity-0 group-hover:opacity-100 translate-y-0.5 group-hover:translate-y-0 px-3 py-1.5 bg-paper border border-line-2 text-ink rounded-md hover:bg-ink hover:text-paper hover:border-ink transition-all"
                      style={{ fontSize: '12.5px', fontWeight: 500 }}
                    >
                      Personnaliser
                    </button>
                  </div>
                  {/* Badges trust */}
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    <span
                      className="font-mono uppercase px-1.5 py-0.5 border border-line rounded text-ink-muted bg-paper"
                      style={{ fontSize: '9.5px', letterSpacing: '0.04em', fontWeight: 500 }}
                    >
                      FSC
                    </span>
                    <span
                      className="font-mono uppercase px-1.5 py-0.5 border border-line rounded text-ink-muted bg-paper"
                      style={{ fontSize: '9.5px', letterSpacing: '0.04em', fontWeight: 500 }}
                    >
                      Fabriqué&nbsp;en&nbsp;France
                    </span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
