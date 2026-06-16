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
  | "kakemono"
  | "packaging"
  | "depliant";

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
  // Brochures (livrets multi-pages relies)
  brochure: "brochure",
  plaquette: "brochure",
  // P15 — Depliants (3 volets plies, distinct de brochure depuis 2026-06-16)
  depliant: "depliant",
  "depliant-3-volets": "depliant",
  "depliant-2-volets": "depliant",
  leaflet_folded: "depliant",
  // P15 — Packaging (boites, pochettes, boites pliees)
  packaging: "packaging",
  boite: "packaging",
  pochette: "packaging",
  emballage: "packaging",
  // P11 (2026-06-15) — Kinds Clariprint qui mappent à brochure pour les livrets
  // relies. P15 (2026-06-16) : folded redirige vers depliant (template dédié
  // 3 volets perspective) plutot que brochure.
  folded: "depliant",
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
 * P14 (2026-06-16) — Inférence du template depuis le nom et la catégorie.
 *
 * Quand `kind` Clariprint est absent (cas Manitou : tous les products library
 * ont `config.kind = NULL` en DB par ex. parce que l'ingestion PIM ne l'a pas
 * rempli), on infère le template depuis le nom commercial du produit et sa
 * catégorie. Évite que tous les produits sans kind tombent sur le même
 * fallback "flyer" → bug visuel "tous les mockups identiques".
 *
 * Pattern emprunté à ProductMockup.tsx (avec extension aux 5 templates SVG).
 */
function inferTemplateFromText(name?: string, category?: string): MockupTemplate {
  const hay = `${category ?? ""} ${name ?? ""}`.toLowerCase();
  if (!hay.trim()) return "flyer";
  // Cartes de visite / commerciales / correspondance / "Cartes" générique.
  // P14 fix : gérer pluriel (cart[eé]s?) + category "Cartes" seul.
  if (/cart[eé]s?(\s+(de\s+)?(visite|commerciale|correspondance|pro))?|bvcard|business\s+card/.test(hay)) {
    return "carteVisite";
  }
  // P15 — Packaging (boites, pochettes, emballages) — template distinct
  if (/packaging|emballage|po?chette|bo[iî]te|carton/.test(hay)) {
    return "packaging";
  }
  // P15 — Depliants (3 volets / 2 volets) — template distinct
  if (/d[eé]pliant|tri.?fold|bi.?fold|leaflet.?fold|3.?volets|2.?volets/.test(hay)) {
    return "depliant";
  }
  // Brochures (livrets relies multi-pages) / catalogues / magazines / plaquettes
  if (/brochure|catalogue|livret|magazine|plaquette/.test(hay)) {
    return "brochure";
  }
  // Étiquettes / stickers / adhésifs / autocollants
  if (/[eé]tiquette|sticker|adh[eé]sif|autocollant|label/.test(hay)) {
    return "etiquette";
  }
  // Kakémonos / roll-ups / banderoles / bâches
  if (/kak[eé]mono|roll[\s-]?up|banderole|b[aâ]che|oriflamme/.test(hay)) {
    return "kakemono";
  }
  // Flyers / tracts / affiches / posters (fallback flyer)
  return "flyer";
}

/**
 * Resout le template SVG approprie pour un produit donne.
 *
 * Lit le `kind` Clariprint depuis 2 sources possibles :
 *   - `product.config.kind` : structure ShopProduct (boutique B2B, library)
 *   - `product.clariprintData.kind` : structure atelier (Product enriched
 *     par le chat IA Marguerite, fix 2026-06-16 bug #1 mauvaise association)
 *
 * Si aucune source ne fournit un kind reconnu, infère depuis name + category
 * (P14 fix 2026-06-16 bug #2 Manitou : tous les products avaient kind=null
 * en DB → tous tombaient sur fallback flyer → tous le même mockup).
 */
export function resolveMockupTemplate(
  product:
    | ShopProduct
    | {
        config?: unknown;
        clariprintData?: unknown;
        name?: string;
        category?: string;
      },
): MockupTemplate {
  const config = (product as { config?: Record<string, unknown> }).config;
  const clariprintData = (product as { clariprintData?: Record<string, unknown> }).clariprintData;
  // Priorité config.kind (path boutique) puis clariprintData.kind (path atelier).
  const rawKind = config?.kind ?? clariprintData?.kind;
  if (typeof rawKind === "string") {
    const normalized = rawKind.toLowerCase().trim();
    const mapped = KIND_TO_TEMPLATE[normalized];
    if (mapped) return mapped;
  }
  // Inférence depuis name + category (P14)
  const name = (product as { name?: string }).name;
  const category = (product as { category?: string }).category;
  return inferTemplateFromText(name, category);
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
