/**
 * S7.7 — ShopHeaderSearch : recherche proéminente du ShopChrome.
 *
 * Réutilise la logique S2.21 (`buildSearchSuggestions`, accent-insensible,
 * produits + familles + repli Magrit) — seule la POSITION change (header).
 * Sélection : produit → fiche `/p/:id` ; famille → page gamme `/g/:famille` ;
 * aucun résultat → « Demander à Magrit » (vue catalogue).
 */

import { useEffect, useRef, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import type { ShopProduct } from '../../contexts/ShopsContext';
import type { Gamme } from '../../utils/productEnrichment';
import { TEST_IDS } from '../../lib/testIds';
import {
  buildSearchSuggestions,
  hasNoMatch,
  MIN_QUERY_LENGTH,
  type SearchSuggestion,
} from '../../utils/catalogSearch';

export interface ShopHeaderSearchProps {
  products: ShopProduct[];
  pimGammes: Gamme[];
  onSelectProduct: (product: ShopProduct) => void;
  onOpenGamme: (slug: string) => void;
  onAskMagrit: () => void;
  isDark?: boolean;
  className?: string;
}

export function ShopHeaderSearch({
  products,
  pimGammes,
  onSelectProduct,
  onOpenGamme,
  onAskMagrit,
  isDark = false,
  className = '',
}: ShopHeaderSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const suggestions = buildSearchSuggestions(query, products, pimGammes);
  const noMatch = hasNoMatch(query, suggestions);
  const showMenu = open && query.trim().length >= MIN_QUERY_LENGTH;

  // Fermeture au clic extérieur
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const select = (s: SearchSuggestion) => {
    setOpen(false);
    setQuery('');
    if (s.type === 'product') onSelectProduct(s.product);
    else onOpenGamme(s.key);
  };

  return (
    <div
      ref={rootRef}
      data-testid={TEST_IDS.shop.headerSearch}
      className={`relative ${className}`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          isDark
            ? 'border-gray-800 bg-gray-900 text-gray-300'
            : 'border-line-2 bg-bg text-ink'
        }`}
      >
        <Search className="w-3.5 h-3.5 shrink-0 opacity-60" strokeWidth={1.5} />
        <input
          type="search"
          data-testid={TEST_IDS.shop.headerSearchInput}
          role="combobox"
          aria-expanded={showMenu}
          aria-controls="shop-header-search-listbox"
          aria-label="Rechercher un produit ou une gamme"
          placeholder="Que voulez-vous imprimer ?"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter') {
              if (suggestions.length > 0) select(suggestions[0]);
              else if (noMatch) {
                setOpen(false);
                onAskMagrit();
              }
            }
          }}
          className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-ink-mute-2 min-w-0"
        />
      </div>

      {showMenu && (
        <div
          id="shop-header-search-listbox"
          data-testid={TEST_IDS.shop.headerSearchMenu}
          role="listbox"
          className={`absolute left-0 right-0 top-full mt-1 z-40 rounded-lg border shadow-lg overflow-hidden ${
            isDark ? 'border-gray-800 bg-gray-950' : 'border-line bg-paper'
          }`}
        >
          {suggestions.map((s) => (
            <button
              key={s.type === 'product' ? `p-${s.id}` : `f-${s.key}`}
              type="button"
              role="option"
              aria-selected="false"
              data-testid={TEST_IDS.shop.headerSearchOption}
              onClick={() => select(s)}
              className={`w-full text-left px-3.5 py-2.5 flex items-baseline justify-between gap-3 transition-colors ${
                isDark ? 'hover:bg-gray-900 text-gray-200' : 'hover:bg-bg text-ink'
              }`}
              style={{ fontSize: '13px' }}
            >
              <span className="truncate">
                {s.label}
                {s.type === 'product' && s.sublabel && (
                  <span className={`ml-2 ${isDark ? 'text-gray-500' : 'text-ink-mute-2'}`} style={{ fontSize: '11.5px' }}>
                    {s.sublabel}
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 font-mono uppercase ${isDark ? 'text-gray-600' : 'text-ink-mute-2'}`}
                style={{ fontSize: '9.5px', letterSpacing: '0.06em' }}
              >
                {s.type === 'product' ? 'produit' : `gamme · ${s.count}`}
              </span>
            </button>
          ))}
          {noMatch && (
            <button
              type="button"
              role="option"
              aria-selected="false"
              data-testid={TEST_IDS.shop.headerSearchAskMagrit}
              onClick={() => {
                setOpen(false);
                onAskMagrit();
              }}
              className={`w-full text-left px-3.5 py-2.5 inline-flex items-center gap-2 transition-colors ${
                isDark ? 'hover:bg-gray-900 text-gray-200' : 'hover:bg-bg text-ink'
              }`}
              style={{ fontSize: '13px' }}
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
              Aucun résultat — demander à Magrit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
