/**
 * S7.8 — Home VITRINE (gabarit boutique v2, refonte de la F1 portail).
 *
 * Pour TOUS les visiteurs (anonyme/SEO inclus — décision Arnaud) :
 * intro sobre → Top Produits (GammeTile « dès X € » par famille peuplée,
 * ADR §4.18) → Nouveautés (S2.15, données réelles) → éditorial tenant
 * (shop.description, masqué si vide) → footer léger.
 *
 * Les mocks de l'ancienne home (« Bonjour Léa », faux numéros de commande,
 * promesse 72 h) sont SUPPRIMÉS. Le bloc reprise panier S2.16 est conservé
 * (remplacé par le ResumeBanner riche en S7.9).
 */

import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Shop, ShopProduct } from '../../../contexts/ShopsContext';
import type { PortalView } from './types';
import type { Gamme, ProductDefinition } from '../../../utils/productEnrichment';
import { resolveNewProducts } from '../../../utils/shopHomeSections';
import { buildShopTaxonomy } from '../../../utils/shopTaxonomy';
import { resolveProductImage } from '../../../utils/productImages';
import { computeGammeFloorPrices } from '../../../utils/gammeFloorPrices';
import { ShopProductCard } from '../ShopProductCard';
import { GammeTile } from '../gamme/GammeTile';
import { TEST_IDS } from '../../../lib/testIds';

interface Props {
  shop: Shop;
  products: ShopProduct[];
  onView: (v: PortalView) => void;
  onSelectProduct: (p: ShopProduct) => void;
  onReorder: (p: ShopProduct) => void;
  /** S7.8 — clic tuile famille → page gamme /g/:slug. */
  onOpenGamme: (slug: string) => void;
  pimGammes?: Gamme[];
  pimDefinitions?: ProductDefinition[];
}

export function PortalHome({
  shop,
  products,
  onView,
  onSelectProduct,
  onReorder,
  onOpenGamme,
  pimGammes,
  pimDefinitions,
}: Props) {
  // S7.8 — Top Produits : familles peuplées (taxonomie ADR-4.17) + planchers
  // « dès X € » (ADR §4.18, calcul à la volée sur les données déjà chargées).
  const families = useMemo(
    () => buildShopTaxonomy(products, pimGammes ?? []).filter((f) => f.count > 0),
    [products, pimGammes],
  );
  const floors = useMemo(
    () => computeGammeFloorPrices(products, pimGammes ?? []),
    [products, pimGammes],
  );

  // S2.15 — Nouveautés : 4 derniers produits intégrés (created_at desc).
  const newProducts = resolveNewProducts(products, 4);

  const editorial = (shop.description ?? '').trim();

  return (
    <div style={{ fontFamily: 'var(--font-ui)' }} className="flex flex-col">
      {/* Intro vitrine — descriptive du comportement réel, pas de claim. */}
      <div
        className="px-5 lg:px-9 py-8 bg-paper border-b border-line"
        style={{ background: 'linear-gradient(180deg, #FFF 0%, var(--bg) 100%)' }}
      >
        <h2
          className="text-ink m-0 mb-2"
          style={{ fontSize: '28px', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.2 }}
        >
          Le catalogue print de <span style={{ fontWeight: 500 }}>{shop.name}</span>
        </h2>
        <p
          className="text-ink-muted m-0 max-w-[620px]"
          style={{ fontSize: '14.5px', lineHeight: 1.55 }}
        >
          Choisissez une gamme, configurez format, papier et finition — le prix
          s'affiche immédiatement. Une question&nbsp;? Magrit vous répond.
        </p>
      </div>

      {/* S2.16 retiré : la reprise panier vit dans le ResumeBanner (S7.9),
          rendu par PublicShop au-dessus de cette home. */}

      {/* S7.8 — Top Produits : tuiles familles « dès X € » */}
      {families.length > 0 && (
        <div className="px-5 lg:px-9 py-8 bg-bg" data-testid={TEST_IDS.shop.homeGammeGrid}>
          <div className="flex items-baseline mb-4">
            <h3 className="text-ink m-0" style={{ fontSize: '17px', fontWeight: 500 }}>
              Nos gammes
            </h3>
            <button
              onClick={() => onView('catalog')}
              className="ml-auto text-ink-muted hover:text-ink inline-flex items-center gap-1"
              style={{ fontSize: '12.5px' }}
            >
              Tout le catalogue <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {families.map((f) => {
              // REFACTO-VISUELS (2026-08-09) : la tuile porte le visuel de la
              // GAMME (`f.imageUrl`, héritage compris via resolveGammeImage),
              // et à défaut celui d'un produit vedette de cette gamme — même
              // chemin que ShopProductCard. Si rien n'est curé, GammeTile rend
              // le repère de famille : jamais le visuel d'une autre famille.
              // NB : f.imageUrl peut valoir '' (image_url vide en prod) — test
              // de vacuité explicite, pas de ??.
              const mockupUrl =
                (f.imageUrl && f.imageUrl.trim() ? f.imageUrl : null) ??
                (f.featured
                  ? resolveProductImage({
                      name: f.featured.name,
                      id: f.featured.id,
                      image_url: f.featured.image_url,
                      kind: (f.featured.config as Record<string, unknown> | undefined)
                        ?.kind as string | undefined,
                      clariprintData: f.featured.config,
                      category: f.featured.category,
                      gammes: pimGammes,
                      definitions: pimDefinitions,
                    })
                  : null);
              return (
                <GammeTile
                  key={f.key}
                  slug={f.key}
                  name={f.label}
                  imageUrl={mockupUrl}
                  productCount={f.count}
                  floor={floors.get(f.key) ?? null}
                  onOpen={onOpenGamme}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* S2.15 — Nouveautés (données réelles, repli si vide) */}
      {newProducts.length > 0 && (
        <div className="px-5 lg:px-9 pb-8 bg-bg" data-testid={TEST_IDS.shop.homeNewProducts}>
          <div className="flex items-baseline mb-4">
            <h3 className="text-ink m-0" style={{ fontSize: '17px', fontWeight: 500 }}>
              Nouveautés
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {newProducts.map((p) => (
              <ShopProductCard
                key={p.id}
                product={p}
                shop={shop}
                onConfigure={onSelectProduct}
                onAddToCart={onReorder}
                onCardClick={onSelectProduct}
                pimGammes={pimGammes}
                pimDefinitions={pimDefinitions}
              />
            ))}
          </div>
        </div>
      )}

      {/* S7.8 — Éditorial tenant (uniquement si renseigné dans le BO) */}
      {editorial && (
        <div className="px-5 lg:px-9 pb-8 bg-bg" data-testid={TEST_IDS.shop.homeEditorial}>
          <section className="bg-paper border border-line rounded-xl px-6 py-5 max-w-[900px]">
            <h3 className="text-ink m-0 mb-2" style={{ fontSize: '15px', fontWeight: 500 }}>
              À propos de {shop.name}
            </h3>
            <p
              className="text-ink-muted m-0"
              style={{ fontSize: '13.5px', lineHeight: 1.6, whiteSpace: 'pre-line' }}
            >
              {editorial}
            </p>
          </section>
        </div>
      )}

      {/* S7.8 — Footer léger */}
      <footer
        data-testid={TEST_IDS.shop.homeFooter}
        className="mt-auto px-5 lg:px-9 py-6 border-t border-line bg-paper flex flex-wrap items-center gap-x-6 gap-y-2"
        style={{ fontSize: '12.5px' }}
      >
        <span className="text-ink" style={{ fontWeight: 500 }}>
          {shop.name}
        </span>
        <button onClick={() => onView('catalog')} className="text-ink-muted hover:text-ink">
          Catalogue
        </button>
        <button onClick={() => onView('orders')} className="text-ink-muted hover:text-ink">
          Mes commandes
        </button>
        <span className="ml-auto text-ink-mute-2">
          Boutique propulsée par Magrit
        </span>
      </footer>
    </div>
  );
}
