/**
 * ShopProductCard — Story S2.3 (Epic 2 Boutique B2B Premium).
 *
 * Card produit dediee a la boutique B2B. Encapsule l'affichage d'un
 * ShopProduct dans la grille catalogue + home + comparateur.
 *
 * Differences vs ProductCard atelier :
 *  - Pas d'onglets Fiche/Prix/Mockup/Editer/Debug (atelier a 5 onglets +
 *    1000+ lignes — refactor sprint cleanup en attente).
 *  - Mockup paramatique brande via MockupImage (S4.3) + template auto via
 *    resolveMockupTemplate(product.config.kind) (S4.2 livre 5 templates).
 *  - Bouton "Configurer & ajouter" primary CTA (placeholder pour S2.4
 *    overlay Clariprint future).
 *  - Bouton "Ajouter direct" hover-reveal secondary (retro-compat onAddToCart).
 *  - Slot multi-selection (selectable + selected + onSelectedChange) pret
 *    pour S2.8.
 *
 * Le composant remplace le rendering inline de PortalCatalog (S2.3 Task 6).
 */

import { useMemo } from "react";
import type { Shop, ShopProduct } from "../../contexts/ShopsContext";
import type { Gamme, ProductDefinition } from "../../utils/productEnrichment";
import { resolveGamme } from "../../utils/productEnrichment";
import { TEST_IDS } from "../../lib/testIds";
import { MockupImage } from "../mockup/MockupImage";
import {
  resolveMockupTemplate,
  resolveProductDimensions,
} from "./ShopProductCard.helpers";

export interface ShopProductCardProps {
  product: ShopProduct;
  /** Boutique courante : utilise pour theming (primaryColor) + tenant scoping mockup. */
  shop: Shop;
  /**
   * Handler bouton "Configurer & ajouter" (CTA primary). Optionnel.
   * En S2.3 MVP, le caller le fait pointer vers onAddToCart direct.
   * En S2.4, ouvrira l'overlay Clariprint.
   */
  onConfigure?: (product: ShopProduct) => void;
  /** Handler bouton secondaire "Ajouter au panier" rapide. Requis. */
  onAddToCart: (product: ShopProduct, qty?: number) => void;
  /** Click sur la card en dehors des boutons. Optionnel (retro-compat onSelectProduct). */
  onCardClick?: (product: ShopProduct) => void;
  /** Mode selection multiple (S2.8). Si true, affiche checkbox top-left. */
  selectable?: boolean;
  /** Etat coche (S2.8). Bind au parent. */
  selected?: boolean;
  /** Callback toggle (S2.8). */
  onSelectedChange?: (selected: boolean) => void;
  /** Classes CSS additionnelles. */
  className?: string;
  /** Gammes PIM disponibles pour resoudre la gamme du produit (S-FIX-2 : badge gamme.name au lieu de category brute LEAFLET). */
  pimGammes?: Gamme[];
}

export function ShopProductCard({
  product,
  shop,
  onConfigure,
  onAddToCart,
  onCardClick,
  selectable = false,
  selected = false,
  onSelectedChange,
  className,
  pimGammes,
}: ShopProductCardProps) {
  const template = useMemo(() => resolveMockupTemplate(product), [product]);
  const dimensions = useMemo(() => resolveProductDimensions(product), [product]);

  // S-FIX-2 — Badge gamme PIM resolue au lieu de product.category brute.
  // Toutes les gammes Clariprint ont matching_rules.kind="leaflet" en PIM,
  // donc category="leaflet" partout. Resolution via PIM rend le badge utile
  // ("Cartes de visite standard", "Carterie", "Flyer A4"...).
  // Fallback : product.category brute si pas de match PIM, puis "Template".
  const gammeName = useMemo(() => {
    if (!pimGammes || pimGammes.length === 0) return null;
    const gamme = resolveGamme(product.config, pimGammes);
    return gamme?.name ?? null;
  }, [product.config, pimGammes]);
  const categoryLabel = gammeName || product.category || "Template";

  // tenant_id n est pas expose sur Shop public (RLS), on retombe sur shop.id
  // comme namespace de cache. La fonction edge mockup-generator accepte les
  // 2 strategies de namespacing (cache key = {tenant}/{shop}/{product}.png).
  const tenantNamespace =
    (shop as Shop & { tenant_id?: string }).tenant_id ?? shop.id;

  return (
    <article
      data-testid={TEST_IDS.shop.productCard}
      data-product-id={product.id}
      className={`group bg-paper border border-transparent rounded-lg overflow-hidden cursor-pointer hover:border-line transition-colors ${className ?? ""}`}
      onClick={() => onCardClick?.(product)}
    >
      {/* ─── Visuel mockup paramatique ───────────────────────────── */}
      <div
        className="aspect-[4/3] overflow-hidden rounded-lg relative"
        style={{ background: "#F5F5F5" }}
      >
        {selectable && (
          <input
            type="checkbox"
            data-testid={TEST_IDS.shop.productCardSelectCheckbox}
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onSelectedChange?.(e.target.checked)}
            aria-label={`Sélectionner ${product.name}`}
            className="absolute top-2.5 left-2.5 z-10 h-4 w-4 cursor-pointer accent-ink"
          />
        )}

        <MockupImage
          tenantId={tenantNamespace}
          shopId={shop.id}
          productId={product.id}
          width={dimensions.width}
          height={dimensions.height}
          productName={product.name}
          primaryColor={shop.theme?.primaryColor ?? "#1e3a8a"}
          template={template}
          alt={`Mockup ${product.name}`}
          className="w-full h-full"
        />

        <span
          className="absolute top-2.5 right-2.5 font-mono uppercase px-2 py-1 rounded bg-ink text-paper"
          style={{ fontSize: "10px", letterSpacing: "0.08em", fontWeight: 500 }}
        >
          {categoryLabel}
        </span>
      </div>

      {/* ─── Bloc info ────────────────────────────────────────────── */}
      <div className="p-3 flex flex-col gap-2">
        <h4
          className="text-ink m-0"
          style={{
            fontSize: "14.5px",
            fontWeight: 500,
            letterSpacing: "-0.005em",
            lineHeight: 1.35,
          }}
        >
          {product.name}
        </h4>

        {product.description && (
          <p
            className="text-ink-muted m-0 line-clamp-2"
            style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: 1.5 }}
          >
            {product.description}
          </p>
        )}

        {/* ─── Ligne prix + actions ───────────────────────────────── */}
        <div className="flex items-center justify-between mt-1.5">
          <div
            className="font-mono text-ink"
            style={{
              fontSize: "16px",
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {product.price_ht.toFixed(0)}
            <span className="text-ink-muted ml-1" style={{ fontSize: "12px" }}>
              €
            </span>
            <span
              className="text-ink-muted ml-1.5"
              style={{ fontSize: "11.5px", fontWeight: 400 }}
            >
              / 500 ex.
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* CTA primary (S2.3 placeholder pour S2.4 overlay) */}
            <button
              type="button"
              data-testid={TEST_IDS.shop.productCardConfigureBtn}
              aria-label={`Configurer et ajouter ${product.name}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onConfigure) {
                  onConfigure(product);
                } else {
                  onAddToCart(product, 1);
                }
              }}
              className="px-3 py-1.5 bg-ink text-paper rounded-md hover:bg-black transition-all"
              style={{ fontSize: "12.5px", fontWeight: 500 }}
            >
              Configurer
            </button>

            {/* S-FIX-4 — Bouton Personnaliser placeholder (Canva future S5.x) */}
            <button
              type="button"
              data-testid={TEST_IDS.shop.productCardPersonalizeBtn}
              aria-label={`Personnaliser ${product.name} (Canva, à venir)`}
              title="Personnaliser via Canva — fonctionnalité à venir"
              onClick={(e) => {
                e.stopPropagation();
                // Canva integration arrive en S5.x (cf. epics.md Epic 5)
                console.info("[S-FIX-4] Bouton Personnaliser — connexion Canva à venir en S5.x");
              }}
              className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-paper border border-line-2 text-ink-2 rounded-md hover:bg-bg hover:text-ink transition-all"
              style={{ fontSize: "12.5px", fontWeight: 500 }}
            >
              Personnaliser
            </button>

            {/* CTA secondary hover-reveal (retro-compat) */}
            <button
              type="button"
              data-testid={TEST_IDS.shop.productCardQuoteBtn}
              aria-label={`Ajouter ${product.name} au panier`}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product, 1);
              }}
              className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-paper border border-line-2 text-ink rounded-md hover:bg-bg transition-all"
              style={{ fontSize: "12.5px", fontWeight: 500 }}
            >
              + Panier
            </button>
          </div>
        </div>

        {/* ─── Badges trust (retro-compat visuelle) ────────────────── */}
        <div className="flex flex-wrap gap-1 mt-0.5">
          <span
            className="font-mono uppercase px-1.5 py-0.5 border border-line rounded text-ink-muted bg-paper"
            style={{ fontSize: "9.5px", letterSpacing: "0.04em", fontWeight: 500 }}
          >
            FSC
          </span>
          <span
            className="font-mono uppercase px-1.5 py-0.5 border border-line rounded text-ink-muted bg-paper"
            style={{ fontSize: "9.5px", letterSpacing: "0.04em", fontWeight: 500 }}
          >
            Fabriqué&nbsp;en&nbsp;France
          </span>
        </div>
      </div>
    </article>
  );
}
