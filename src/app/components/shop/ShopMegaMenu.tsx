/**
 * ShopMegaMenu — S2.18 (Epic 2, FR-ECOM-08, Sprint E3 Navigation).
 *
 * Méga-menu 2 niveaux auto-illustré : une barre de familles (repère couleur +
 * picto S2.11 + compteur) ; l'ouverture d'une famille déploie un panneau avec
 * ses sous-catégories (gammes) et une vignette vedette.
 *
 * Data-driven : alimenté par `buildShopTaxonomy` (jamais vide même sans gammes).
 * A11y AA : disclosure `aria-expanded`/`aria-controls`, fermeture Escape, la
 * couleur ne porte jamais l'info seule (picto + libellé toujours présents).
 */

import { useId, useRef, useState } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';
import type { TaxonomyFamily } from '../../utils/shopTaxonomy';
import { TEST_IDS } from '../../lib/testIds';

interface Props {
  families: TaxonomyFamily[];
  isDark?: boolean;
  /** Clic sur une famille (racine) → catalogue filtré sur ses gammes (racine + enfants). */
  onSelectFamily: (gammeSlugs: string[]) => void;
  /** Clic sur une sous-catégorie (gamme) → catalogue filtré sur cette gamme. */
  onSelectSubcategory: (gammeSlugs: string[]) => void;
}

export function ShopMegaMenu({ families, isDark, onSelectFamily, onSelectSubcategory }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const baseId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!families.length) return null;

  const open = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenKey(key);
  };
  // Léger délai à la sortie souris pour permettre le déplacement vers le panneau.
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenKey(null), 120);
  };

  return (
    <div
      data-testid={TEST_IDS.shop.megaMenu}
      className={`hidden md:flex items-stretch gap-1 px-5 lg:px-9 border-b ${
        isDark ? 'bg-gray-950 border-gray-800' : 'bg-paper border-line'
      }`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpenKey(null);
      }}
    >
      {families.map((fam) => {
        const Icon = fam.icon;
        const isOpen = openKey === fam.key;
        const panelId = `${baseId}-${fam.key}`;
        return (
          <div
            key={fam.key}
            className="relative"
            onMouseEnter={() => open(fam.key)}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              data-testid={TEST_IDS.shop.megaMenuFamily}
              data-family={fam.key}
              aria-haspopup="true"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onFocus={() => open(fam.key)}
              onClick={() => onSelectFamily(fam.gammeSlugs)}
              className={`inline-flex items-center gap-1.5 py-2.5 px-2 text-[13px] border-b-2 transition-colors ${
                isOpen
                  ? isDark
                    ? 'border-gray-100 text-gray-100'
                    : 'border-ink text-ink'
                  : isDark
                    ? 'border-transparent text-gray-400 hover:text-gray-100'
                    : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: fam.tone }}
                aria-hidden="true"
              />
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>{fam.label}</span>
              {fam.count > 0 && (
                <span
                  className={`font-mono ${isDark ? 'text-gray-500' : 'text-ink-mute-2'}`}
                  style={{ fontSize: '10.5px', fontVariantNumeric: 'tabular-nums' }}
                >
                  {fam.count}
                </span>
              )}
              {fam.subcategories.length > 0 && (
                <ChevronDown
                  className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              )}
            </button>

            {isOpen && fam.subcategories.length > 0 && (
              <div
                id={panelId}
                data-testid={TEST_IDS.shop.megaMenuPanel}
                role="region"
                aria-label={`Sous-catégories ${fam.label}`}
                className={`absolute left-0 top-full z-30 mt-px flex gap-5 p-4 rounded-b-xl border shadow-lg min-w-[420px] ${
                  isDark ? 'bg-gray-950 border-gray-800' : 'bg-paper border-line'
                }`}
                onMouseEnter={() => open(fam.key)}
                onMouseLeave={scheduleClose}
              >
                {/* Colonne sous-catégories */}
                <ul className="flex-1 flex flex-col gap-0.5 min-w-[200px]">
                  {fam.subcategories.map((sub) => (
                    <li key={sub.key}>
                      <button
                        type="button"
                        data-testid={TEST_IDS.shop.megaMenuSubcat}
                        data-gamme-slug={sub.key}
                        onClick={() => onSelectSubcategory(sub.gammeSlugs)}
                        className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                          isDark ? 'text-gray-300 hover:bg-gray-900' : 'text-ink-2 hover:bg-bg hover:text-ink'
                        }`}
                      >
                        <span className="truncate">{sub.label}</span>
                        <span
                          className={`ml-auto font-mono ${isDark ? 'text-gray-500' : 'text-ink-mute-2'}`}
                          style={{ fontSize: '10.5px', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {sub.count}
                        </span>
                      </button>
                    </li>
                  ))}
                  <li className="mt-1 pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={() => onSelectFamily(fam.gammeSlugs)}
                      className={`w-full text-left inline-flex items-center gap-1 px-2.5 py-1.5 text-[12.5px] ${
                        isDark ? 'text-gray-400 hover:text-gray-100' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      Voir tout {fam.label} <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </li>
                </ul>

                {/* Vignette vedette */}
                <div className="w-[140px] shrink-0">
                  <div
                    className="w-full h-[100px] rounded-lg overflow-hidden grid place-items-center"
                    style={{ background: `${fam.tone}1a` }}
                  >
                    {fam.featured?.image_url ? (
                      <img
                        src={fam.featured.image_url}
                        alt=""
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Icon
                        className="w-8 h-8"
                        strokeWidth={1.25}
                        style={{ color: fam.tone }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  {fam.featured && (
                    <p
                      className={`mt-1.5 m-0 truncate text-[12px] ${isDark ? 'text-gray-400' : 'text-ink-muted'}`}
                    >
                      {fam.featured.name}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
