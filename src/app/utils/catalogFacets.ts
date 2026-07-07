/**
 * S2.19 (Epic 2, FR-ECOM-09) — Facettes légères du catalogue boutique.
 *
 * Décision Arnaud 2026-07-07 (ADR-4.17) : la FAMILLE vient de la gamme explicite
 * (filtrée en amont) ; le FORMAT redevient un FILTRE (facette), pas une catégorie.
 *
 * Facettes data-driven : Format (A-size / dimensions) + Prix (tranches). PAS de
 * variantes techniques fines (papier/finition — la card est configurable).
 * Helpers purs testables.
 */

import type { ShopProduct } from '../contexts/ShopsContext';

export interface Facet {
  key: string;
  label: string;
  count: number;
}

// ─── Format ──────────────────────────────────────────────────────────────────

/** Label de format normalisé d'un produit (A5, « 85 × 55 mm », sinon « Autre »). */
export function resolveFormatLabel(product: Pick<ShopProduct, 'config'>): string {
  const cfg = (product.config ?? {}) as Record<string, unknown>;
  const raw = String(cfg.format ?? '').trim();
  const aSize = raw.match(/\bA[0-6]\b/i);
  if (aSize) return aSize[0].toUpperCase();
  const dims = raw.match(/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)/i);
  if (dims) return `${dims[1]} × ${dims[2]} ${dims[3].toLowerCase()}`;
  return raw ? raw.split('(')[0].trim().slice(0, 24) || 'Autre' : 'Autre';
}

export function deriveFormatFacets(products: ShopProduct[]): Facet[] {
  const map = new Map<string, number>();
  for (const p of products) {
    const label = resolveFormatLabel(p);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ key: label, label, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.label.localeCompare(b.label, 'fr')));
}

// ─── Prix ────────────────────────────────────────────────────────────────────

interface PriceBucket {
  key: string;
  label: string;
  test: (price: number) => boolean;
}

const PRICE_BUCKETS: PriceBucket[] = [
  { key: 'lt100', label: '< 100 €', test: (p) => p < 100 },
  { key: '100_500', label: '100 – 500 €', test: (p) => p >= 100 && p <= 500 },
  { key: 'gt500', label: '> 500 €', test: (p) => p > 500 },
];

export function derivePriceFacets(products: ShopProduct[]): Facet[] {
  return PRICE_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    count: products.filter((p) => b.test(p.price_ht ?? 0)).length,
  })).filter((f) => f.count > 0);
}

// ─── Application ─────────────────────────────────────────────────────────────

export interface FacetSelection {
  formats: Set<string>;
  price: string | null;
}

/** Filtrage composable et non mutant : formats (OU) puis tranche de prix. */
export function applyFacets(products: ShopProduct[], sel: FacetSelection): ShopProduct[] {
  let result = products;
  if (sel.formats.size > 0) {
    result = result.filter((p) => sel.formats.has(resolveFormatLabel(p)));
  }
  if (sel.price) {
    const bucket = PRICE_BUCKETS.find((b) => b.key === sel.price);
    if (bucket) result = result.filter((p) => bucket.test(p.price_ht ?? 0));
  }
  return result;
}

export function hasActiveFacets(sel: FacetSelection): boolean {
  return sel.formats.size > 0 || sel.price !== null;
}
