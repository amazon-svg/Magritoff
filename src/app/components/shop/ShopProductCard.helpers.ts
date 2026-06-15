/**
 * Helpers purs pour ShopProductCard (Story S2.3, Epic 2).
 *
 * Surface :
 *  - resolveMockupTemplate(product) -> MockupTemplate (mapping product.config.kind
 *    Clariprint vers les 5 templates SVG MVP livres en S4.2). Fallback `flyer`.
 *  - resolveProductDimensions(product) -> { width, height } en mm. Lecture depuis
 *    config.width/height, fallback parsing config.format (A4/A5/...), default 148/210.
 *  - parseFormatToDimensions(format) -> { width, height } | null. Helper expose pour
 *    tests + reuse.
 *
 * Type MockupTemplate dupliqu cot front (le type Deno _shared/mockup/types.ts
 * n'est pas importable depuis Vite/React sans alias build cross-environnement).
 * A harmoniser dans le sprint refacto en attente (cf. memoire
 * project_refacto_sprint_pending).
 */

import type { ShopProduct } from "../../contexts/ShopsContext";

/**
 * Templates SVG mockup supportes (5 MVP livres en S4.2 + deployes v2 sur prod).
 * Source de verite cote Deno : supabase/functions/_shared/mockup/types.ts
 */
export type MockupTemplate =
  | "flyer"
  | "carteVisite"
  | "brochure"
  | "etiquette"
  | "kakemono";

/**
 * Mapping product.kind Clariprint -> template SVG. Aliases et synonymes courants
 * pour absorber les variations de nommage entre Clariprint et Magrit PIM.
 *
 * Clefs en lowercase apres trim (cf. resolveMockupTemplate).
 */
const KIND_TO_TEMPLATE: Record<string, MockupTemplate> = {
  // Flyers / tracts (feuilles plates)
  flyer: "flyer",
  leaflet: "flyer",
  affiche: "flyer",
  tract: "flyer",
  // Cartes de visite
  carte_visite: "carteVisite",
  card: "carteVisite",
  visite: "carteVisite",
  // Brochures / livrets / dépliants
  brochure: "brochure",
  depliant: "brochure",
  plaquette: "brochure",
  // P11 (2026-06-15) — Kinds Clariprint manquants qui mappent à brochure :
  // folded (plié 2/3 volets), book (livret cousu/agrafé), cover (couverture
  // brochure), section (feuilles d'une brochure). Sans ce mapping, ces
  // produits ERAM/Manitou recevaient un mockup `flyer` par défaut (bug
  // remonté Arnaud 2026-06-15).
  folded: "brochure",
  book: "brochure",
  cover: "brochure",
  section: "brochure",
  // Étiquettes / stickers
  etiquette: "etiquette",
  sticker: "etiquette",
  label: "etiquette",
  // Kakémonos / roll-ups / banderoles
  kakemono: "kakemono",
  rollup: "kakemono",
  "roll-up": "kakemono",
  banner: "kakemono",
};

/**
 * Resout le template SVG approprie pour un produit donne.
 * Fallback `flyer` si product.config.kind absent ou inconnu.
 */
export function resolveMockupTemplate(product: ShopProduct): MockupTemplate {
  const kind = (product.config as Record<string, unknown> | undefined)?.kind;
  if (typeof kind !== "string") return "flyer";
  const normalized = kind.toLowerCase().trim();
  return KIND_TO_TEMPLATE[normalized] ?? "flyer";
}

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
