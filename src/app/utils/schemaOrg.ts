import type { Shop, ShopProduct } from '../contexts/ShopsContext';
import type { EnrichedProduct } from './productEnrichment';
import { applyTax, DEFAULT_TAX_RATE } from './tax';

// Génère un objet Product schema.org pour un produit de boutique.
// Note R0 : taxRate optionnel — fallback metropole_fr 20 %. Le call-site qui a
// le tenant en scope (composant React) doit passer getTaxRate(currentTenant).
export function productSchema(
  shop: Shop,
  product: ShopProduct,
  enriched: EnrichedProduct | null,
  shopUrl: string,
  taxRate: number = DEFAULT_TAX_RATE
) {
  const priceTTC = applyTax(product.price_ht, taxRate);
  const description =
    enriched?.resolved.description ||
    enriched?.resolved.short_description ||
    product.description ||
    product.name;

  return {
    '@context': 'https://schema.org',
    '@type': enriched?.definition?.schema_org_type || 'Product',
    name: enriched?.resolved.title || product.name,
    description,
    image: product.image_url || undefined,
    category: product.category,
    sku: product.id,
    brand: { '@type': 'Brand', name: shop.name },
    keywords: enriched?.resolved.keywords?.join(', ') || undefined,
    offers: {
      '@type': 'Offer',
      url: shopUrl,
      price: priceTTC.toFixed(2),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      priceValidUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    },
  };
}

// Génère un FAQPage schema.org à partir de la FAQ de la definition.
export function faqSchema(enriched: EnrichedProduct | null) {
  if (!enriched?.resolved.faq || enriched.resolved.faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: enriched.resolved.faq.map((qa) => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: { '@type': 'Answer', text: qa.answer },
    })),
  };
}

// Génère un BreadcrumbList pour la hiérarchie des gammes.
export function breadcrumbSchema(shop: Shop, product: ShopProduct, shopUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: shop.name, item: shopUrl },
      ...(product.category
        ? [{ '@type': 'ListItem', position: 2, name: product.category, item: `${shopUrl}#${product.category}` }]
        : []),
      { '@type': 'ListItem', position: product.category ? 3 : 2, name: product.name },
    ],
  };
}

// Assemble les JSON-LD blocs en un tableau JSON compact injectable.
export function combineSchemas(...items: Array<Record<string, unknown> | null>): string {
  const clean = items.filter(Boolean);
  return JSON.stringify(clean, null, 0);
}
