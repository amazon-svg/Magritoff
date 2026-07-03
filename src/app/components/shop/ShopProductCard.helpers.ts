/**
 * Helpers purs pour ShopProductCard (Story S2.3, Epic 2).
 *
 * Surface :
 *  - resolveMockupTemplate / resolveProductImage : RE-EXPORTES depuis
 *    utils/productMockupAssets (source unique des visuels Gemini, partagee avec
 *    utils/productImages pour home + fiche produit). Conserves ici pour
 *    retro-compat (imports existants + tests).
 *  - resolveProductDimensions(product) -> { width, height } en mm. Lecture depuis
 *    config.width/height, fallback parsing config.format (A4/A5/...), default 148/210.
 *  - parseFormatToDimensions(format) -> { width, height } | null. Helper expose pour
 *    tests + reuse.
 */

import type { ShopProduct } from "../../contexts/ShopsContext";

// P18 v2 (2026-06-24) — La resolution de famille (kind Clariprint + inference)
// et le mapping vers les 7 visuels Gemini ont ete extraits dans
// utils/productMockupAssets : source de verite unique, partagee entre la
// boutique (catalogue) et utils/productImages (home + fiche produit). On
// re-exporte ici pour ne pas casser les imports existants (ShopProductCard.tsx,
// tests ShopProductCard.helpers).
export {
  resolveMockupTemplate,
  resolveProductMockupAsset as resolveProductImage,
  type MockupTemplate,
} from "../../utils/productMockupAssets";

/**
 * Format papier standard FR -> dimensions en mm (portrait par defaut).
 * Source : ISO 216 + DIN B series courants en print.
 */
const FORMAT_TO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  a3: { width: 297, height: 420 },
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  a6: { width: 105, height: 148 },
  a7: { width: 74, height: 105 },
  // Cartes de visite courantes
  bvcard: { width: 85, height: 55 },
  "carte-visite": { width: 85, height: 55 },
  "85x55": { width: 85, height: 55 },
};

/**
 * Parse une string de format (ex "A5", "A4", "85x55") en dimensions mm.
 * Retourne null si format inconnu ou non parseable.
 */
export function parseFormatToDimensions(
  format: string | undefined | null,
): { width: number; height: number } | null {
  if (!format || typeof format !== "string") return null;
  const normalized = format.toLowerCase().trim().replace(/\s+/g, "");
  if (FORMAT_TO_DIMENSIONS[normalized]) {
    return FORMAT_TO_DIMENSIONS[normalized];
  }
  // Pattern "WxH" ou "WxH mm" (ex "85x55", "210x297mm")
  const match = normalized.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
  if (match) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }
  return null;
}

const DEFAULT_DIMENSIONS = { width: 148, height: 210 } as const; // A5 portrait

/**
 * Resout les dimensions produit en mm pour passer au mockup engine.
 * Strategie :
 *  1. config.width et config.height sont des nombres > 0 -> les utiliser.
 *  2. Sinon parser config.format (A5, A4, "85x55"...).
 *  3. Sinon fallback 148x210 (A5 portrait).
 */
export function resolveProductDimensions(
  product: ShopProduct,
): { width: number; height: number } {
  const config = product.config as Record<string, unknown> | undefined;
  if (config) {
    const width = config.width;
    const height = config.height;
    if (
      typeof width === "number" &&
      typeof height === "number" &&
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    ) {
      return { width, height };
    }
    const format = config.format;
    if (typeof format === "string") {
      const parsed = parseFormatToDimensions(format);
      if (parsed) return parsed;
    }
  }
  return { ...DEFAULT_DIMENSIONS };
}
