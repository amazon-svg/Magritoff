/**
 * Visuels produits PRÉ-BRANDÉS Magrit (Gemini) — source unique.
 *
 * P18 v2 (2026-06-23/24) : 7 visuels Magrit pre-brandes (branding integre dans
 * l'image, perspective + lighting coherents), servis en assets statiques front
 * (JPG q85, object-contain). Memes 7 visuels vitrine pour tous les tenants
 * (cf. brief-gemini-v2-mockups-prebrandes).
 *
 * Ce module est la SOURCE DE VERITE partagee :
 *  - ShopProductCard (catalogue) l'utilise via resolveProductImage curee->Gemini
 *  - utils/productImages (home + fiche produit) l'utilise en fallback universel
 *
 * La resolution template (kind Clariprint + inference nom/categorie) vit ici ;
 * ShopProductCard.helpers la re-exporte pour retro-compat.
 */

import imgCarteVisite from "@/assets/products/magrit-carte-visite.jpg";
import imgFlyer from "@/assets/products/magrit-flyer.jpg";
import imgBrochure from "@/assets/products/magrit-brochure.jpg";
import imgDepliant from "@/assets/products/magrit-depliant.jpg";
import imgEtiquette from "@/assets/products/magrit-etiquette.jpg";
import imgKakemono from "@/assets/products/magrit-kakemono.jpg";
import imgPackaging from "@/assets/products/magrit-packaging.jpg";

/**
 * Familles de visuels supportees. Les `id` du manifest Gemini correspondent
 * exactement a ce type. Source de verite cote Deno : _shared/mockup/types.ts.
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
 * Mapping product.kind Clariprint -> famille de visuel. Aliases et synonymes
 * courants pour absorber les variations de nommage Clariprint <-> Magrit PIM.
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
  // Depliants (3 volets plies, distinct de brochure depuis 2026-06-16)
  depliant: "depliant",
  "depliant-3-volets": "depliant",
  "depliant-2-volets": "depliant",
  leaflet_folded: "depliant",
  // Packaging (boites, pochettes, boites pliees)
  packaging: "packaging",
  boite: "packaging",
  pochette: "packaging",
  emballage: "packaging",
  // Kinds Clariprint qui mappent a brochure pour les livrets relies.
  // folded redirige vers depliant (template dedie 3 volets perspective).
  folded: "depliant",
  book: "brochure",
  cover: "brochure",
  section: "brochure",
  // Etiquettes / stickers
  etiquette: "etiquette",
  sticker: "etiquette",
  label: "etiquette",
  // Kakemonos / roll-ups / banderoles
  kakemono: "kakemono",
  rollup: "kakemono",
  "roll-up": "kakemono",
  banner: "kakemono",
};

/**
 * Inference de la famille depuis le nom commercial et la categorie quand le
 * `kind` Clariprint est absent (cas Manitou : config.kind = NULL en DB). Evite
 * que tous les produits sans kind tombent sur le meme fallback "flyer".
 */
function inferTemplateFromText(name?: string, category?: string): MockupTemplate {
  const hay = `${category ?? ""} ${name ?? ""}`.toLowerCase();
  if (!hay.trim()) return "flyer";
  if (/cart[eé]s?(\s+(de\s+)?(visite|commerciale|correspondance|pro))?|bvcard|business\s+card/.test(hay)) {
    return "carteVisite";
  }
  if (/packaging|emballage|po?chette|bo[iî]te|carton/.test(hay)) {
    return "packaging";
  }
  if (/d[eé]pliant|tri.?fold|bi.?fold|leaflet.?fold|3.?volets|2.?volets/.test(hay)) {
    return "depliant";
  }
  if (/brochure|catalogue|livret|magazine|plaquette/.test(hay)) {
    return "brochure";
  }
  if (/[eé]tiquette|sticker|adh[eé]sif|autocollant|label/.test(hay)) {
    return "etiquette";
  }
  if (/kak[eé]mono|roll[\s-]?up|banderole|b[aâ]che|oriflamme/.test(hay)) {
    return "kakemono";
  }
  return "flyer";
}

/** Structure minimale acceptee par les resolveurs (boutique, atelier, PIM). */
export interface MockupTemplateInput {
  config?: unknown;
  clariprintData?: unknown;
  kind?: string;
  name?: string;
  category?: string;
}

/**
 * Resout la famille de visuel pour un produit.
 * Priorite : config.kind (boutique) > clariprintData.kind (atelier) > kind brut,
 * puis inference depuis name + category.
 */
export function resolveMockupTemplate(product: MockupTemplateInput): MockupTemplate {
  const config = (product as { config?: Record<string, unknown> }).config;
  const clariprintData = (product as { clariprintData?: Record<string, unknown> }).clariprintData;
  const rawKind = config?.kind ?? clariprintData?.kind ?? product.kind;
  // Inference nom + categorie : toujours calculee, sert d'arbitre quand le kind
  // Clariprint est trop grossier (cf. ci-dessous).
  const nameTemplate = inferTemplateFromText(product.name, product.category);
  if (typeof rawKind === "string") {
    const normalized = rawKind.toLowerCase().trim();
    const mapped = KIND_TO_TEMPLATE[normalized];
    if (mapped) {
      // Clariprint range cartes de visite ET flyers (et autres feuilles plates)
      // sous le meme kind grossier (ex: "leaflet" -> flyer). Quand le kind
      // retombe sur ce bucket "flyer" mais que le NOM designe une famille plus
      // specifique (ex: "Cartes de visite premium"), le nom prime. Les kinds
      // precis (carte_visite, brochure, depliant, packaging...) gardent la
      // priorite.
      if (mapped === "flyer" && nameTemplate !== "flyer") return nameTemplate;
      return mapped;
    }
  }
  return nameTemplate;
}

/** Mapping famille -> URL d'asset Gemini (Vite resout l'import en URL au build). */
const TEMPLATE_TO_PRODUCT_IMAGE: Record<MockupTemplate, string> = {
  carteVisite: imgCarteVisite,
  flyer: imgFlyer,
  brochure: imgBrochure,
  depliant: imgDepliant,
  etiquette: imgEtiquette,
  kakemono: imgKakemono,
  packaging: imgPackaging,
};

/**
 * Resout le visuel produit pre-brande Magrit pour un produit donne (toujours
 * une URL non vide : fallback `flyer` garanti par resolveMockupTemplate).
 */
export function resolveProductMockupAsset(product: MockupTemplateInput): string {
  return TEMPLATE_TO_PRODUCT_IMAGE[resolveMockupTemplate(product)];
}
