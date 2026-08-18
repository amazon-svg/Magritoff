/**
 * S7.3 — GammePage : l'expérience déterminante du gabarit boutique v2.
 *
 * `/shop/:slug/g/:gamme` — « j'atterris, je vois un prix < 3 s, je façonne en
 * temps réel, j'ajoute au panier ». Layout spec UX : breadcrumb → H1 +
 * réassurance → visuel 40 / configurateur 60 (pile mobile, config d'abord) →
 * StickyPriceBar (colonne desktop / barre basse mobile).
 *
 * Gamme vide ou inconnue : page rendue quand même (état vide + CTA Magrit,
 * jamais de 404 — spec UX Empty States). L'éditorial PIM arrive en S7.4.
 */

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { Shop, ShopProduct } from '../../../contexts/ShopsContext';
import type { Gamme, ProductDefinition } from '../../../utils/productEnrichment';
import { TEST_IDS } from '../../../lib/testIds';
import { resolveProductImage } from '../../../utils/productImages';
import { useProductConfigurator } from '../../../hooks/useProductConfigurator';
import { applyTax } from '../../../utils/tax';
import {
  pickDefaultProduct,
  resolveGammeInfo,
  selectGammeProducts,
} from './gammePage.helpers';
import { useSeoMeta } from '../../../hooks/useSeoMeta';
import { pickDefinition } from './pimEditorial.helpers';
import { buildGammeJsonLd, buildGammeSeo } from './gammeSeo.helpers';
import { GammeConfigurator } from './GammeConfigurator';
import { StickyPriceBar } from './StickyPriceBar';
import { PimEditorial } from './PimEditorial';
import { ShopProductCard } from '../ShopProductCard';

export interface GammePageProps {
  shop: Shop;
  taxRate: number;
  gammeSlug: string | undefined;
  products: ShopProduct[];
  pimGammes: Gamme[];
  pimDefinitions: ProductDefinition[];
  onAddToCart: (product: ShopProduct, qty: number) => void;
  onGoHome: () => void;
  onGoCatalog: () => void;
  /** S7.4 — navigation vers une autre page gamme (breadcrumb famille). */
  onGoGamme: (slug: string) => void;
  /** S7.4 — clic carte produit lié → fiche /p/:id. */
  onSelectProduct: (product: ShopProduct) => void;
  /** Filet Magrit : ouvre la zone de recherche Magrit (vue catalogue). */
  onAskMagrit: () => void;
}

export function GammePage({
  shop,
  taxRate,
  gammeSlug,
  products,
  pimGammes,
  pimDefinitions,
  onAddToCart,
  onGoHome,
  onGoCatalog,
  onGoGamme,
  onSelectProduct,
  onAskMagrit,
}: GammePageProps) {
  const { gamme, family } = useMemo(
    () => resolveGammeInfo(gammeSlug, pimGammes),
    [gammeSlug, pimGammes],
  );
  const gammeProducts = useMemo(
    () => selectGammeProducts(products, pimGammes, gammeSlug),
    [products, pimGammes, gammeSlug],
  );
  const defaultProduct = pickDefaultProduct(gammeProducts);

  // Moteur unique S7.2 — recalc live (exigence < 1,5 s par option).
  const { options, patchOptions, phase, retry, confirm, addDisabled } =
    useProductConfigurator(defaultProduct, { liveRecalc: true, taxRate });

  const title = gamme?.name ?? gammeSlug ?? 'Gamme';

  const priceHT =
    phase.kind === 'ready'
      ? phase.priceHT
      : phase.kind === 'error' && phase.fallbackPriceHT != null
        ? phase.fallbackPriceHT
        : defaultProduct
          ? defaultProduct.price_ht
          : null;
  const priceTTC =
    phase.kind === 'ready'
      ? phase.priceTTC
      : phase.kind === 'error' && phase.fallbackPriceTTC != null
        ? phase.fallbackPriceTTC
        : priceHT != null
          ? applyTax(priceHT, taxRate)
          : null;

  // S7.5 — SEO on-page (ADR §4.19-2/3). Canonical sur l'URL courante,
  // JSON-LD Product (offers UNIQUEMENT sur prix Clariprint réel).
  const seoDefinition = useMemo(
    () => pickDefinition(pimDefinitions, gamme?.slug ?? gammeSlug, family?.slug),
    [pimDefinitions, gamme?.slug, gammeSlug, family?.slug],
  );
  const seo = useMemo(
    () =>
      buildGammeSeo(
        seoDefinition,
        gamme,
        gammeSlug,
        shop.name,
        defaultProduct ? options : null,
      ),
    [seoDefinition, gamme, gammeSlug, shop.name, defaultProduct, options],
  );
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shopBaseUrl = `${origin}/shop/${shop.slug}`;
  const canonical = `${shopBaseUrl}/g/${gamme?.slug ?? gammeSlug ?? ''}`;
  useSeoMeta({
    title: seo.title,
    description: seo.description,
    canonical,
    og: { type: 'product' },
    jsonLd: buildGammeJsonLd({
      seo,
      gamme,
      family,
      shopName: shop.name,
      canonical,
      shopUrl: shopBaseUrl,
      phase,
      imageUrl: gamme?.image_url || defaultProduct?.image_url || null,
    }),
    jsonLdId: 'magrit-gamme-jsonld',
  });

  const handleAdd = () => {
    const result = confirm();
    if (!result) return;
    // S-FIX-PANIER-11/05 (même normalisation que PortalCatalog) : le prix est
    // FORFAITAIRE pour le pack configuré → panier qty=1 pack, exemplaires
    // stockés dans config.quantity (sinon price_ht × qty multiplie par les ex).
    const withQty = {
      ...result.productConfigured,
      config: {
        ...((result.productConfigured.config as Record<string, unknown>) ?? {}),
        quantity: result.qty,
      },
    } as ShopProduct;
    onAddToCart(withQty, 1);
  };

  return (
    <div data-testid={TEST_IDS.shop.gammePage} className="flex flex-col gap-5 pb-24 lg:pb-0">
      {/* Breadcrumb minimal (enrichi S7.4) */}
      <nav
        data-testid={TEST_IDS.shop.gammeBreadcrumb}
        aria-label="Fil d'Ariane"
        className="flex items-center gap-1.5 text-ink-muted"
        style={{ fontSize: '12px' }}
      >
        <button type="button" onClick={onGoHome} className="hover:text-ink hover:underline">
          Accueil
        </button>
        {family && family.slug !== gamme?.slug && (
          <>
            <span aria-hidden="true">›</span>
            <button
              type="button"
              onClick={() => onGoGamme(family.slug)}
              className="hover:text-ink hover:underline"
            >
              {family.name}
            </button>
          </>
        )}
        <span aria-hidden="true">›</span>
        <span aria-current="page" className="text-ink">
          {title}
        </span>
      </nav>

      {/* H1 + réassurance courte */}
      <div>
        <h1
          data-testid={TEST_IDS.shop.gammePageTitle}
          className="text-ink m-0"
          style={{ fontSize: '30px', fontWeight: 300, letterSpacing: '-0.02em' }}
        >
          Impression {title}
        </h1>
        <p className="text-ink-muted m-0 mt-1" style={{ fontSize: '13px' }}>
          Prix immédiat · Configuration en temps réel · Devis en 1 clic
        </p>
      </div>

      {defaultProduct ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Visuel 40 % — vignette réduite en mobile (config d'abord) */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div
              className="aspect-[4/3] overflow-hidden rounded-lg"
              style={{ background: '#F5F5F5' }}
            >
              <img
                src={resolveProductImage({
                  name: defaultProduct.name,
                  id: defaultProduct.id,
                  image_url: (defaultProduct as { image_url?: string }).image_url,
                  kind: (defaultProduct.config as Record<string, unknown> | undefined)?.kind as
                    | string
                    | undefined,
                  clariprintData: defaultProduct.config,
                  category: defaultProduct.category,
                })}
                alt={`Mockup ${title}`}
                loading="lazy"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-ink-mute-2 m-0 mt-2" style={{ fontSize: '11.5px' }}>
              Configuration basée sur « {defaultProduct.name} » — ajustez les options,
              le prix suit.
            </p>
          </div>

          {/* Configurateur 60 % + prix sticky */}
          <div className="lg:col-span-3 order-1 lg:order-2 grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
            <div className="xl:col-span-2">
              <GammeConfigurator
                options={options}
                patchOptions={patchOptions}
                phase={phase}
                onRetry={retry}
              />
            </div>
            <div className="hidden lg:block">
              <StickyPriceBar
                variant="column"
                phase={phase}
                priceHT={priceHT}
                priceTTC={priceTTC}
                quantity={options.quantity}
                addDisabled={addDisabled}
                onAddToCart={handleAdd}
                onAskMagrit={onAskMagrit}
              />
            </div>
          </div>
        </div>
      ) : (
        /* État vide : jamais de 404 sur une gamme du menu */
        <div
          data-testid={TEST_IDS.shop.gammeEmptyState}
          className="rounded-lg border border-line bg-paper px-6 py-10 text-center flex flex-col items-center gap-3"
        >
          <p className="text-ink m-0" style={{ fontSize: '15px', fontWeight: 500 }}>
            {gamme
              ? `Aucun produit ${gamme.name} n'est encore proposé dans cette boutique.`
              : 'Cette gamme n\'existe pas dans le catalogue.'}
          </p>
          <p className="text-ink-muted m-0" style={{ fontSize: '13px' }}>
            Décrivez votre besoin à Magrit : elle vous propose une configuration et un prix.
          </p>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              data-testid={TEST_IDS.shop.gammeAskMagrit}
              onClick={onAskMagrit}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-ink text-paper hover:bg-black transition-colors"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
              Demander à Magrit
            </button>
            <button
              type="button"
              onClick={onGoCatalog}
              className="px-4 py-2 rounded-md border border-line-2 bg-paper text-ink hover:bg-bg transition-colors"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              Voir le catalogue
            </button>
          </div>
        </div>
      )}

      {/* S7.4 — Éditorial PIM (product_definitions, placeholders résolus) */}
      <PimEditorial
        definitions={pimDefinitions}
        gammeSlug={gamme?.slug ?? gammeSlug}
        familySlug={family?.slug}
        options={defaultProduct ? options : null}
      />

      {/* S7.4 — Produits liés de la gamme (ShopProductCard inchangé) */}
      {gammeProducts.length > 1 && (
        <section data-testid={TEST_IDS.shop.gammeRelated} aria-label="Produits de la gamme">
          <h2
            className="text-ink m-0 mb-3"
            style={{ fontSize: '19px', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Produits de la gamme
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {gammeProducts.slice(0, 6).map((p) => (
              <ShopProductCard
                key={p.id}
                product={p}
                shop={shop}
                pimGammes={pimGammes}
                onCardClick={onSelectProduct}
                onConfigure={onSelectProduct}
                onAddToCart={(prod, qty) => onAddToCart(prod, qty ?? 1)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Barre basse mobile */}
      {defaultProduct && (
        <StickyPriceBar
          variant="bottom"
          phase={phase}
          priceHT={priceHT}
          priceTTC={priceTTC}
          quantity={options.quantity}
          addDisabled={addDisabled}
          onAddToCart={handleAdd}
          onAskMagrit={onAskMagrit}
        />
      )}
    </div>
  );
}
