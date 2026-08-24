/**
 * S7.5 — Helpers PURS SEO de la page gamme (ADR §4.19-2/3).
 *
 * Meta depuis product_definitions.seo_* (placeholders résolus S7.4), repli
 * « Impression {Gamme} — {Boutique} ». JSON-LD Product/BreadcrumbList ; le
 * bloc `offers` n'est émis QUE sur un prix Clariprint réel (phase ready) —
 * jamais sur une estimation marché (règle dure §4.19-3).
 */

import type { Gamme, ProductDefinition } from '@/modules/catalog/ui/helpers/productEnrichment';
import type { ConfiguratorPhase } from '@/modules/clariprint/ui/hooks';
import { resolvePimTemplate, type PimTemplateOptions } from '@/modules/catalog/ui/storefront/gamme/pimEditorial.helpers';

export interface GammeSeo {
  title: string;
  description: string;
}

export function buildGammeSeo(
  definition: ProductDefinition | null,
  gamme: Gamme | null,
  gammeSlug: string | undefined,
  shopName: string,
  options?: PimTemplateOptions | null,
): GammeSeo {
  const gammeName = gamme?.name ?? gammeSlug ?? 'Impression';
  const fallbackTitle = `Impression ${gammeName} — ${shopName}`;
  const fallbackDescription =
    `${gammeName} : configurez format, papier et finition, prix immédiat. ` +
    `Boutique ${shopName}.`;

  const title = resolvePimTemplate(definition?.seo_title, options) || fallbackTitle;
  const description =
    resolvePimTemplate(definition?.seo_description, options) || fallbackDescription;
  return { title, description };
}

/**
 * JSON-LD de la page gamme : Product + BreadcrumbList.
 * `priceHT` n'est fourni par l'appelant QUE si la phase est `ready`
 * (prix Clariprint réel) — garde redondante ici par sécurité.
 */
export function buildGammeJsonLd(args: {
  seo: GammeSeo;
  gamme: Gamme | null;
  family: Gamme | null;
  shopName: string;
  canonical: string;
  shopUrl: string;
  phase: ConfiguratorPhase;
  imageUrl?: string | null;
}): Record<string, unknown> {
  const { seo, gamme, family, shopName, canonical, shopUrl, phase, imageUrl } = args;

  const product: Record<string, unknown> = {
    '@type': 'Product',
    name: seo.title,
    description: seo.description,
    url: canonical,
    brand: { '@type': 'Organization', name: shopName },
  };
  if (imageUrl) product.image = imageUrl;

  // Règle §4.19-3 : jamais d'engagement de prix sur une estimation.
  if (phase.kind === 'ready') {
    product.offers = {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: phase.priceHT,
      availability: 'https://schema.org/InStock',
    };
  }

  const crumbs: Array<{ name: string; item: string }> = [
    { name: 'Accueil', item: shopUrl },
  ];
  if (family && family.slug !== gamme?.slug) {
    crumbs.push({ name: family.name, item: `${shopUrl}/g/${family.slug}` });
  }
  if (gamme) crumbs.push({ name: gamme.name, item: canonical });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      product,
      {
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: c.item,
        })),
      },
    ],
  };
}
