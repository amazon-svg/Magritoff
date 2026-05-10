/**
 * ShopGammesSidebar — Story S2.2 (Epic 2 Boutique B2B Premium).
 *
 * Sidebar gauche du ShopLayout : navigation hierarchique des gammes
 * souscrites par le tenant qui possede la shop, avec :
 *  - Hierarchie parent/enfant (carterie -> carte-visite + carte-correspondance)
 *  - Compteur produits par gamme (mono uppercase)
 *  - Click chevron : toggle expand visuel + ajoute/retire la gamme au filtre
 *  - Etat multi-gammes additif (Set<slug>)
 *  - Persistance localStorage par shop (cle namespacee)
 *  - Badge "N FILTRES" si >= 1 gamme deplie (UX rappel filtre actif)
 *
 * Les gammes sans produits matchant sont masquees (compteur 0 = no UI vide).
 * Le state expandedSlugs vit cote consommateur (PublicShop) pour pouvoir
 * filtrer aussi la grille produits.
 */

import { useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ShopProduct } from "../../contexts/ShopsContext";
import type { Gamme } from "../../utils/productEnrichment";
import { TEST_IDS } from "../../lib/testIds";
import {
  buildGammeTree,
  groupProductsByGamme,
} from "./ShopGammesSidebar.helpers";

export interface ShopGammesSidebarProps {
  /** Gammes a afficher (typiquement souscrites du tenant filtrees). */
  gammes: Gamme[];
  /** Catalogue produits courant (utilise pour le comptage par gamme). */
  products: ShopProduct[];
  /** Set des slugs de gammes deplices. Vit dans le parent. */
  expandedSlugs: Set<string>;
  /** Callback toggle. */
  onToggleGamme: (slug: string) => void;
  /** Theme dark mode (cohere ShopLayout S2.1). */
  isDark?: boolean;
}

export function ShopGammesSidebar({
  gammes,
  products,
  expandedSlugs,
  onToggleGamme,
  isDark = false,
}: ShopGammesSidebarProps) {
  const gammeMap = useMemo(
    () => groupProductsByGamme(products, gammes),
    [products, gammes],
  );
  const tree = useMemo(() => buildGammeTree(gammes), [gammes]);

  const filterCount = expandedSlugs.size;

  // Filtrer les racines avec count > 0 (no UI vide). Si aucune gamme a count > 0,
  // afficher un message "Aucune gamme disponible".
  const visibleRoots = tree.roots.filter((g) => {
    const directCount = gammeMap.get(g.slug)?.length ?? 0;
    const childrenCount = (tree.childrenByParent.get(g.slug) ?? []).reduce(
      (sum, child) => sum + (gammeMap.get(child.slug)?.length ?? 0),
      0,
    );
    return directCount + childrenCount > 0;
  });

  return (
    <div data-testid={TEST_IDS.shop.gammesList} className="p-4">
      {/* Header section */}
      <div className="flex items-baseline justify-between mb-4">
        <span
          className={`font-mono uppercase ${isDark ? "text-gray-500" : "text-ink-mute-2"}`}
          style={{ fontSize: "10.5px", letterSpacing: "0.08em", fontWeight: 500 }}
        >
          Gammes
        </span>
        {filterCount > 0 && (
          <span
            data-testid={TEST_IDS.shop.gammesFilterBadge}
            className={`font-mono px-1.5 py-0.5 rounded uppercase ${
              isDark ? "bg-gray-100 text-gray-950" : "bg-ink text-paper"
            }`}
            style={{ fontSize: "9.5px", letterSpacing: "0.06em", fontWeight: 500 }}
          >
            {filterCount} FILTRE{filterCount > 1 ? "S" : ""}
          </span>
        )}
      </div>

      {/* Liste racines */}
      {visibleRoots.length === 0 ? (
        <p
          className={`text-[12.5px] m-0 ${isDark ? "text-gray-500" : "text-ink-muted"}`}
          style={{ lineHeight: 1.55 }}
        >
          Aucune gamme disponible.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5 list-none p-0 m-0">
          {visibleRoots.map((g) => {
            const directCount = gammeMap.get(g.slug)?.length ?? 0;
            const children = tree.childrenByParent.get(g.slug) ?? [];
            const isExpanded = expandedSlugs.has(g.slug);
            const totalCount =
              directCount +
              children.reduce(
                (sum, c) => sum + (gammeMap.get(c.slug)?.length ?? 0),
                0,
              );

            return (
              <li key={g.slug} data-testid={TEST_IDS.shop.gammeRow} data-gamme-slug={g.slug}>
                <button
                  type="button"
                  data-testid={TEST_IDS.shop.gammeToggleBtn}
                  aria-expanded={isExpanded}
                  aria-label={`Déplier la gamme ${g.name} (${totalCount} produits)`}
                  onClick={() => onToggleGamme(g.slug)}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors ${
                    isExpanded
                      ? isDark
                        ? "bg-gray-800 text-gray-100"
                        : "bg-bg text-ink"
                      : isDark
                        ? "text-gray-300 hover:bg-gray-800/60"
                        : "text-ink-2 hover:bg-bg/60"
                  }`}
                  style={{
                    fontSize: "13px",
                    fontWeight: isExpanded ? 500 : 400,
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <ChevronRight
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.5}
                    />
                  )}
                  <span className="flex-1 truncate">{g.name}</span>
                  <span
                    className={`font-mono ${isDark ? "text-gray-500" : "text-ink-mute-2"}`}
                    style={{
                      fontSize: "11px",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {totalCount}
                  </span>
                </button>

                {/* Sous-gammes affichees quand le parent est deplie */}
                {isExpanded && children.length > 0 && (
                  <ul className="flex flex-col gap-0.5 list-none p-0 m-0 ml-4 mt-0.5">
                    {children
                      .filter((c) => (gammeMap.get(c.slug)?.length ?? 0) > 0)
                      .map((c) => {
                        const childCount = gammeMap.get(c.slug)?.length ?? 0;
                        const childExpanded = expandedSlugs.has(c.slug);
                        return (
                          <li
                            key={c.slug}
                            data-testid={TEST_IDS.shop.gammeRow}
                            data-gamme-slug={c.slug}
                          >
                            <button
                              type="button"
                              data-testid={TEST_IDS.shop.gammeToggleBtn}
                              aria-pressed={childExpanded}
                              aria-label={`${childExpanded ? "Désactiver" : "Activer"} le filtre ${c.name} (${childCount} produits)`}
                              onClick={() => onToggleGamme(c.slug)}
                              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-colors ${
                                childExpanded
                                  ? isDark
                                    ? "bg-gray-700 text-gray-100"
                                    : "bg-line text-ink"
                                  : isDark
                                    ? "text-gray-400 hover:bg-gray-800/40"
                                    : "text-ink-muted hover:bg-bg/40"
                              }`}
                              style={{
                                fontSize: "12.5px",
                                fontWeight: childExpanded ? 500 : 400,
                              }}
                            >
                              <span className="flex-1 truncate">— {c.name}</span>
                              <span
                                className={`font-mono ${isDark ? "text-gray-500" : "text-ink-mute-2"}`}
                                style={{
                                  fontSize: "10.5px",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {childCount}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
