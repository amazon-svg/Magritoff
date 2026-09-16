import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ShopProduct } from '@/modules/shops';
import { resolveProductImage } from '@/modules/catalog/ui/helpers/productImages';
import type { Gamme, ProductDefinition } from '@/modules/catalog/ui/helpers/productEnrichment';
import { resolveProductGamme } from '@/modules/catalog/ui/helpers/productEnrichment';
import { ProductMockup } from '@/modules/mockups/ui/components';
import { resolvePrice } from '@/modules/clariprint/ui/helpers';
import { applyTax } from '@/modules/orders/ui/helpers';
import { TEST_IDS } from '@/shared/presentation/testIds';
import {
  MARKET_PRICE_BADGE_LABEL,
  MARKET_PRICE_BADGE_TOOLTIP,
  resolveProductPriceDisplay,
} from '@/modules/catalog/ui/storefront/productPriceDisplay';

interface Props {
  product: ShopProduct;
  taxRate: number;
  onBack: () => void;
  /**
   * BCP-10 (docs/api/CONVENTIONS.md §8.25 point 3.5 (a)/(f)) — la fiche ne
   * configure plus, ne chiffre plus, n'ajoute plus au panier. Son unique
   * bouton ouvre la SEULE surface de configuration, la surcouche
   * `ProductOverlay`, hébergée une fois par `PublicShop` et ouverte
   * PAR-DESSUS la fiche (l'URL `/p/:id` ne change pas).
   */
  onConfigure: (product: ShopProduct) => void;
  pimGammes?: Gamme[];
  pimDefinitions?: ProductDefinition[];
}

// F3 — Fiche produit descriptive (BCP-10 : la configuration vit exclusivement
// dans la surcouche `ProductOverlay`, ouverte par le bouton ci-dessous).
// Design source : .design-handoff/designs/05 - Portail B2B.html (section .f3)
export function PortalProduct({ product, taxRate, onBack, onConfigure, pimGammes, pimDefinitions }: Props) {
  // CR §2 (13/05) : afficher la gamme PIM résolue dans le breadcrumb plutôt
  // que `product.category` brut (qui vaut "leaflet" pour ~90% des products
  // library, hérité du kind Clariprint). Fallback : kind Clariprint masqué,
  // category sinon, ou "Produit" si ni l'un ni l'autre.
  const breadcrumbGammeLabel = useMemo(() => {
    if (pimGammes && pimGammes.length > 0) {
      const gamme = resolveProductGamme(product, pimGammes);
      if (gamme?.name) return gamme.name;
    }
    const cat = product.category;
    if (cat && !/^(leaflet|folded|book|cover|section)$/i.test(cat)) {
      return cat;
    }
    return 'Produit';
  }, [pimGammes, product.config, product.name, product.category]);

  // BCP-10 point 3.5 (g) — la quantité affichée est celle STOCKÉE (comme sur
  // la carte catalogue), plus un sélecteur : la fiche ne configure plus rien.
  const quantity = Number((product.config as any)?.quantity) || 500;

  // BCP-10 point 3.5 (g) — la fiche adopte la règle DÉJÀ écrite au point 4
  // (a) du cadrage : `resolvePrice(product, product.config.clariprintQuote
  // ?? null)`, puis la fonction pure « résolution → texte + badge » créée par
  // ce lot. Plus aucun chiffrage propre à la fiche : l'ancien appel Clariprint
  // dédié et sa mise à l'échelle proportionnelle sur la quantité sont
  // supprimés, pas déplacés — c'était la seule branche de calcul de prix hors
  // de `resolvePrice()` dans tout le dépôt.
  const priceResolution = resolvePrice(product, (product.config as any)?.clariprintQuote ?? null);
  const priceDisplay = resolveProductPriceDisplay(priceResolution);

  const imgSrc = resolveProductImage({
    name: product.name,
    id: product.id,
    image_url: product.image_url,
    kind: (product.config as any)?.kind,
    clariprintData: product.config,
    gammes: pimGammes,
    definitions: pimDefinitions,
  });

  return (
    <div
      data-testid={TEST_IDS.shop.productPage}
      className="p-9 bg-paper"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      {/* Breadcrumbs */}
      <div
        className="font-mono text-ink-mute-2 mb-4"
        style={{ fontSize: '12px', letterSpacing: '0.02em' }}
      >
        <button onClick={onBack} className="hover:text-ink">Catalogue</button>
        <ChevronRight className="inline w-3 h-3 mx-1.5" strokeWidth={1.5} />
        <span className="text-ink-muted">{breadcrumbGammeLabel}</span>
        <ChevronRight className="inline w-3 h-3 mx-1.5" strokeWidth={1.5} />
        <span className="text-ink" style={{ fontWeight: 500 }}>{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10">
        {/* Visuel */}
        <div>
          <div className="aspect-[4/3] rounded-xl overflow-hidden border border-line relative bg-bg">
            {imgSrc ? (
              <img src={imgSrc} alt={product.name} className="w-full h-full object-contain" />
            ) : (
              <ProductMockup
                name={product.name}
                kind={(product.config as any)?.kind}
                category={product.category}
                className="w-full h-full"
              />
            )}
          </div>

          {/* S-CONSO-1 (Sprint 4 Phase 2) : thumbs placeholder retires —
              ils suggeraient des vues multiples non implementees. Story
              future S-PRODUCT-VIEWS-MULTI hors scope v1.1. */}
        </div>

        {/* Info descriptive (BCP-10 : plus de configurateur ici) */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-baseline gap-3 mb-3">
              <h3
                className="text-ink m-0"
                style={{ fontSize: '29px', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1 }}
              >
                {product.name}
              </h3>
              {product.category && (
                <span
                  className="font-mono uppercase px-2 py-0.5 rounded bg-ink text-paper"
                  style={{ fontSize: '10.5px', letterSpacing: '0.06em', fontWeight: 500 }}
                >
                  {product.category}
                </span>
              )}
            </div>
            {product.description && (
              <p
                className="text-ink-muted m-0"
                style={{ fontSize: '14px', fontWeight: 400, lineHeight: 1.55 }}
              >
                {product.description}
              </p>
            )}
          </div>

          {/* Zone Prix — règle unique resolvePrice() + résolution → texte + badge (BCP-10) */}
          <div
            data-testid={TEST_IDS.shop.productPagePrice}
            className="rounded-lg bg-ink text-paper overflow-hidden"
          >
            <div className="flex items-baseline gap-3.5 px-4.5 py-4">
              {priceDisplay.kind === 'priced' ? (
                <>
                  <div
                    className="font-mono tabular-nums"
                    style={{ fontSize: '26px', fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {applyTax(priceDisplay.priceHT, taxRate).toFixed(0)}€
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#B5B5BC', fontWeight: 400 }}>
                    TTC · {quantity} ex. · {priceDisplay.priceHT.toFixed(2)}€ HT
                  </div>
                  {priceDisplay.badge && (
                    <span
                      className="ml-auto font-mono uppercase rounded px-1.5 py-0.5 bg-warn-bg text-warn-fg"
                      style={{ fontSize: '9.5px', letterSpacing: '0.05em' }}
                      title={MARKET_PRICE_BADGE_TOOLTIP}
                    >
                      {MARKET_PRICE_BADGE_LABEL}
                    </span>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '16px', fontWeight: 500 }}>
                  {priceDisplay.label}
                </div>
              )}
            </div>
          </div>

          <button
            data-testid={TEST_IDS.shop.productPageConfigureBtn}
            onClick={() => onConfigure(product)}
            className="py-3.5 px-5 rounded-lg bg-brand text-brand-ink hover:bg-black transition-colors"
            style={{ fontSize: '14.5px', fontWeight: 500, fontFamily: 'var(--font-ui)' }}
          >
            Configurer
          </button>
        </div>
      </div>
    </div>
  );
}
