/**
 * Helpers purs pour ProductOverlay (Story S2.4, Epic 2).
 *
 * Constantes des options Clariprint (listes statiques MVP — pas de matrice
 * dynamique selon parc imprimeur, decision MVP cf. story S2.4 Project
 * Structure Notes).
 *
 * Helpers :
 *  - extractInitialOptions(product) -> ConfigOptions : pre-remplit depuis
 *    product.config.clariprintData avec defaults safe.
 *  - buildClariprintPayload(options, baseConfig) -> Record<string, unknown> :
 *    construit le payload Clariprint pour computePrice() en preservant les
 *    champs immuables (kind) du baseConfig.
 *  - parseFormatToWidthHeight(format) -> { width, height } | null : etend
 *    parseFormatToDimensions de S2.3 avec les formats overlay (Custom).
 *  - formatEuro(priceHT, locale?) -> string : formatage 1 234,56 EUR.
 */

import type { ShopProduct } from "../../contexts/ShopsContext";

export const QUANTITIES = [50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;
export const FORMATS = [
  "A6",
  "A5",
  "A4",
  "A3",
  "A2",
  "A1",
  "A0",
  "85x55",
  "210x210",
  "Custom",
] as const;
export const PAPERS = [
  "90g",
  "115g",
  "135g",
  "170g",
  "250g",
  "300g",
  "350g",
] as const;
export const FINISHINGS = [
  "aucun",
  "mat",
  "brillant",
  "soft-touch",
] as const;
export const PRINTINGS = ["recto", "recto-verso"] as const;
export const DORURES = ["aucune", "or", "argent"] as const;

export type FormatOption = (typeof FORMATS)[number];
export type PaperOption = (typeof PAPERS)[number];
export type FinishingOption = (typeof FINISHINGS)[number];
export type PrintingOption = (typeof PRINTINGS)[number];
export type DorureOption = (typeof DORURES)[number];

export interface ConfigOptions {
  quantity: number;
  format: FormatOption | string; // string pour absorber valeurs externes
  paper: PaperOption | string;
  finishingFront: FinishingOption | string;
  finishingVerso: FinishingOption | string;
  printing: PrintingOption;
  dorure: DorureOption | string;
  /** Largeur custom en mm si format === 'Custom'. */
  customWidth?: number;
  /** Hauteur custom en mm si format === 'Custom'. */
  customHeight?: number;
}

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  a6: { width: 105, height: 148 },
  a5: { width: 148, height: 210 },
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
  a2: { width: 420, height: 594 },
  a1: { width: 594, height: 841 },
  a0: { width: 841, height: 1189 },
  "85x55": { width: 85, height: 55 },
  "210x210": { width: 210, height: 210 },
};

/**
 * Inverse de FORMAT_DIMENSIONS : depuis width/height (mm), retourne le nom
 * de format standard (ex: 420/594 -> "A2"). Tolere l'ordre portrait/paysage
 * et une petite tolerance numerique (arrondis).
 * Retourne null si aucun format standard ne correspond.
 */
function matchStandardFormat(width: number, height: number): string | null {
  const tolerance = 2; // mm de tolerance (arrondis LLM possibles)
  for (const [key, dim] of Object.entries(FORMAT_DIMENSIONS)) {
    const matchPortrait =
      Math.abs(dim.width - width) <= tolerance &&
      Math.abs(dim.height - height) <= tolerance;
    const matchLandscape =
      Math.abs(dim.width - height) <= tolerance &&
      Math.abs(dim.height - width) <= tolerance;
    if (matchPortrait || matchLandscape) {
      // Retourne le label tel qu'il apparait dans FORMATS (uppercase pour
      // les Ax, conserve pour les autres).
      return /^a\d$/i.test(key) ? key.toUpperCase() : key;
    }
  }
  return null;
}

/**
 * Extrait le label de format standard depuis une string libre.
 * Reconnait :
 *  - "A2 (420 × 594 mm)" -> "A2"
 *  - "85x55", "85 x 55 mm" -> "85x55"
 *  - "A4 paysage" -> "A4"
 * Retourne null si rien n'est reconnu.
 */
function extractStandardFormatLabel(format: string): string | null {
  const normalized = format.toLowerCase();
  // Match "A0".."A6" en mot complet
  const axMatch = normalized.match(/\ba([0-6])\b/);
  if (axMatch) return `A${axMatch[1]}`;
  // Match WxH (avec ou sans espaces / "x" / "×")
  const wxhMatch = normalized
    .replace(/\s+/g, "")
    .replace(/×/g, "x")
    .match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
  if (wxhMatch) {
    const key = `${wxhMatch[1]}x${wxhMatch[2]}`;
    if (FORMAT_DIMENSIONS[key]) return key;
  }
  return null;
}

/**
 * Detecte si une valeur de dimension semble etre en CENTIMETRES (LLM
 * Clariprint renvoie souvent width/height en cm, ex: "42" / "59.4" pour A2
 * = 42 x 59.4 cm = 420 x 594 mm). Heuristique : valeur < 30 sur un format
 * imprimable typique -> probablement cm (un papier imprimable mesure
 * rarement moins de 3 cm).
 */
function isLikelyCm(width: number, height: number): boolean {
  // Seuils : le plus petit format imprimable raisonnable en mm fait ~50mm
  // (timbre ~30mm). Si width ET height sont sous 100, considere comme cm.
  return width > 0 && height > 0 && width < 100 && height < 100;
}

/**
 * Parse une string format en dimensions mm. Retourne null pour "Custom"
 * (le caller doit alors lire customWidth / customHeight) ou format inconnu.
 */
export function parseFormatToWidthHeight(
  format: string | undefined | null,
): { width: number; height: number } | null {
  if (!format || typeof format !== "string") return null;
  const normalized = format.toLowerCase().trim().replace(/\s+/g, "");
  if (normalized === "custom") return null; // signal pour le caller
  if (FORMAT_DIMENSIONS[normalized]) return FORMAT_DIMENSIONS[normalized];
  // Pattern WxH libre (ex "85x55", "210x297mm")
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

const DEFAULT_OPTIONS: ConfigOptions = {
  quantity: 500,
  format: "A5",
  paper: "135g",
  finishingFront: "aucun",
  finishingVerso: "aucun",
  printing: "recto",
  dorure: "aucune",
};

/**
 * Lit les options initiales depuis product.config.clariprintData (ou
 * product.config si pas de nesting clariprintData). Defauts safe partout.
 */
export function extractInitialOptions(product: ShopProduct): ConfigOptions {
  const cfg = product?.config as Record<string, any> | undefined;
  const c = (cfg?.clariprintData ?? cfg ?? {}) as Record<string, any>;

  const quantity =
    typeof c.quantity === "number"
      ? c.quantity
      : typeof c.quantity === "string"
        ? parseInt(c.quantity, 10) || DEFAULT_OPTIONS.quantity
        : DEFAULT_OPTIONS.quantity;

  let format: ConfigOptions["format"] = DEFAULT_OPTIONS.format;
  if (typeof c.format === "string" && c.format) {
    format = c.format;
  } else if (typeof c.width === "number" && typeof c.height === "number") {
    format = `${c.width}x${c.height}`;
  }

  const paper = Array.isArray(c.papers)
    ? c.papers[0] ?? DEFAULT_OPTIONS.paper
    : (c.paper as string) ?? DEFAULT_OPTIONS.paper;

  const finishingFront =
    (c.finishing_front as string) ??
    (c.finishingFront as string) ??
    DEFAULT_OPTIONS.finishingFront;
  const finishingVerso =
    (c.finishing_back as string) ??
    (c.finishingVerso as string) ??
    DEFAULT_OPTIONS.finishingVerso;

  // Recto-verso si back_colors > 0 OU printing explicite == 'recto-verso'
  let printing: PrintingOption = DEFAULT_OPTIONS.printing;
  if (c.printing === "recto-verso" || c.printing === "recto") {
    printing = c.printing;
  } else if (typeof c.back_colors === "number" && c.back_colors > 0) {
    printing = "recto-verso";
  }

  const dorure = (c.dorure as string) ?? DEFAULT_OPTIONS.dorure;

  return {
    quantity,
    format,
    paper,
    finishingFront,
    finishingVerso,
    printing,
    dorure,
  };
}

/**
 * Construit le payload Clariprint pour computePrice().
 * Preserve `kind` et autres champs immuables du baseConfig (config produit
 * d'origine), surcharge avec les options choisies.
 *
 * Convention Clariprint :
 *  - papers: array (1+ choix)
 *  - finishing_front / finishing_back : string ("aucun" omis)
 *  - dorure : string ("aucune" omise pour ne pas polluer le payload)
 *  - back_colors : 4 si recto-verso, 0 si recto
 */
export function buildClariprintPayload(
  options: ConfigOptions,
  baseConfig: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const base = (baseConfig as Record<string, any>) ?? {};
  const baseClariprint = (base.clariprintData ?? base) as Record<string, any>;

  // Resolution des dimensions
  let width: number | undefined;
  let height: number | undefined;
  if (options.format === "Custom") {
    width = options.customWidth;
    height = options.customHeight;
  } else {
    const parsed = parseFormatToWidthHeight(options.format);
    if (parsed) {
      width = parsed.width;
      height = parsed.height;
    }
  }

  const payload: Record<string, unknown> = {
    // Immutables : kind du produit (ne change pas via overlay MVP)
    kind: baseClariprint.kind ?? "flyer",
    quantity: options.quantity,
    width,
    height,
    papers: [options.paper],
    front_colors:
      typeof baseClariprint.front_colors === "number"
        ? baseClariprint.front_colors
        : 4,
    back_colors: options.printing === "recto-verso" ? 4 : 0,
  };

  if (options.finishingFront !== "aucun") {
    payload.finishing_front = options.finishingFront;
  }
  if (options.finishingVerso !== "aucun" && options.printing === "recto-verso") {
    payload.finishing_back = options.finishingVerso;
  }
  if (options.dorure !== "aucune") {
    payload.dorure = options.dorure;
  }
  // Champs additionnels du baseConfig conserves (folds, binding, pages, ...)
  // qui ne sont pas exposes dans l overlay MVP
  for (const k of ["folds", "binding", "pages"]) {
    if (baseClariprint[k] != null && payload[k] == null) {
      payload[k] = baseClariprint[k];
    }
  }

  return payload;
}

/**
 * Mappe un libelle humain de finition (UI ou LLM) vers l'enum overlay.
 * Defauts safe : libelle vide / inconnu / "Sans finition" -> "aucun".
 * 2026-05-15 — Bug fix volet d'edition ProductCard atelier : les libelles
 * "Pelliculage mat" / "Brillant" / "Soft-touch" venaient de localProduct.
 */
function normalizeFinishingLabel(raw: unknown): FinishingOption {
  if (typeof raw !== "string") return "aucun";
  const v = raw.toLowerCase().trim();
  if (!v || v === "sans finition" || v === "aucun" || v === "aucune") return "aucun";
  // "soft-touch", "soft_touch", "softtouch"
  if (v.includes("soft") && v.includes("touch")) return "soft-touch";
  // "brillant", "brilliant", "PELLIC_BRILL" (LLM Clariprint code)
  if (v.includes("brill")) return "brillant";
  // "mat", "matte", "PELLIC_ACETATE_MAT" (LLM Clariprint code)
  if (v.includes("mat")) return "mat";
  return "aucun";
}

/**
 * Construit un objet "clariprintData" normalise (format attendu par
 * `extractInitialOptions`) a partir d'un produit atelier au format UI/LLM
 * (champs `material`, `weight`, `dimensions`, `finishRecto`, `finishVerso`,
 * `printing: { recto, verso }`).
 *
 * Pourquoi : depuis le refacto R1 ProductCard (2026-05-11), le bouton
 * "Editer" ouvre `ProductOverlay` (S2.4b). Or `localProduct` cote atelier
 * a des champs UI (`material`, `finishRecto`, `dimensions.width`, ...)
 * incompatibles avec le contrat Clariprint qu'attend `extractInitialOptions`
 * (`papers` array, `finishing_front` snake_case, `width` top-level, ...).
 * Resultat : 5 champs sur 7 retombaient sur DEFAULT_OPTIONS (A5 / 135g /
 * recto / aucun) au lieu d'afficher les valeurs du produit.
 *
 * Ce helper fait le mapping UI/LLM -> contrat overlay, en preservant les
 * champs Clariprint bruts (kind, folds, binding, pages, front_colors) si
 * `localProduct.clariprintData` les expose deja.
 */
export function extractClariprintConfigFromAtelierProduct(
  localProduct: Record<string, any> | null | undefined,
): Record<string, any> {
  if (!localProduct || typeof localProduct !== "object") return {};

  const raw = (localProduct.clariprintData as Record<string, any> | undefined) ?? {};

  // Quantite : valeur "haute" prioritaire (post-edit ou Clariprint brut number)
  const quantity =
    typeof localProduct.quantity === "number"
      ? localProduct.quantity
      : typeof raw.quantity === "number"
        ? raw.quantity
        : typeof raw.quantity === "string"
          ? parseInt(raw.quantity, 10) || undefined
          : undefined;

  // Resolution format + dimensions (mm) en cascade :
  //  1. Label UI format reconnu (A2, A4, 85x55, ...) -> source de verite mm
  //     via FORMAT_DIMENSIONS. Gere "A2 (420 × 594 mm)" verbose LLM.
  //  2. raw Clariprint string (LLM brut en CM) -> conversion cm->mm si
  //     valeur < 100 (heuristique cf. isLikelyCm).
  //  3. raw Clariprint number (deja mm).
  //  4. dimensions: { width, height } nested cote UI (deja mm).
  //  5. Synthese WxH brute en dernier recours.
  let width: number | undefined;
  let height: number | undefined;
  let format: string | undefined;

  // (1) Label UI prioritaire pour resoudre format ET dimensions.
  if (typeof localProduct.format === "string" && localProduct.format.trim()) {
    const stdLabel = extractStandardFormatLabel(localProduct.format);
    if (stdLabel) {
      format = stdLabel;
      const parsed = parseFormatToWidthHeight(stdLabel);
      if (parsed) {
        width = parsed.width;
        height = parsed.height;
      }
    }
  }

  // (2-3) raw Clariprint (LLM) si dims pas encore resolues.
  if (width == null || height == null) {
    if (typeof raw.width === "number" && typeof raw.height === "number") {
      width = raw.width;
      height = raw.height;
    } else if (typeof raw.width === "string" && typeof raw.height === "string") {
      let w = parseFloat(raw.width);
      let h = parseFloat(raw.height);
      if (Number.isFinite(w) && Number.isFinite(h)) {
        if (isLikelyCm(w, h)) {
          w = Math.round(w * 10);
          h = Math.round(h * 10);
        }
        width = w;
        height = h;
      }
    }
  }

  // (4) dimensions UI (deja mm) en fallback final.
  if (width == null || height == null) {
    const dims = localProduct.dimensions as { width?: unknown; height?: unknown } | undefined;
    if (dims && typeof dims.width === "number" && typeof dims.height === "number") {
      width = dims.width;
      height = dims.height;
    }
  }

  // (5) Si format pas encore connu, tenter matchStandardFormat depuis dims
  // resolues, sinon synthese brute WxH.
  if (!format && typeof width === "number" && typeof height === "number") {
    const standard = matchStandardFormat(width, height);
    format = standard ?? `${width}x${height}`;
  }

  // Papier : raw Clariprint prioritaire (array post-edit ou objet LLM brut),
  // sinon weight UI (number), sinon regex sur material.
  let paper: string | undefined;
  if (Array.isArray(raw.papers) && typeof raw.papers[0] === "string") {
    paper = raw.papers[0];
  } else if (raw.papers && typeof raw.papers === "object") {
    const w = (raw.papers as any)?.custom?.weight;
    if (typeof w === "string" || typeof w === "number") {
      paper = `${w}g`;
    }
  }
  if (!paper && typeof localProduct.weight === "number" && localProduct.weight > 0) {
    paper = `${localProduct.weight}g`;
  }
  if (!paper && typeof localProduct.material === "string") {
    const m = localProduct.material.match(/(\d{2,4})\s*g/i);
    if (m) paper = `${m[1]}g`;
  }

  // Finitions : raw Clariprint prioritaire (post-edit), sinon libelles UI.
  const finishing_front = normalizeFinishingLabel(
    raw.finishing_front ?? localProduct.finishRecto ?? localProduct.finish,
  );
  const finishing_back = normalizeFinishingLabel(
    raw.finishing_back ?? localProduct.finishVerso,
  );

  // Impression : raw.printing (post-edit) prioritaire, sinon raw.back_colors,
  // sinon objet UI printing { recto, verso }.
  let printing: PrintingOption | undefined;
  if (raw.printing === "recto" || raw.printing === "recto-verso") {
    printing = raw.printing;
  } else if (Array.isArray(raw.back_colors) && raw.back_colors.length > 0) {
    printing = "recto-verso";
  } else if (typeof raw.back_colors === "number") {
    printing = raw.back_colors > 0 ? "recto-verso" : "recto";
  } else if (Array.isArray(raw.back_colors) && raw.back_colors.length === 0) {
    printing = "recto";
  } else {
    const printingUI = localProduct.printing as
      | { recto?: unknown; verso?: unknown }
      | string
      | undefined;
    if (printingUI && typeof printingUI === "object") {
      const verso = typeof printingUI.verso === "string"
        ? printingUI.verso.toLowerCase().trim()
        : "";
      if (!verso || verso === "sans impression" || verso === "aucune") {
        printing = "recto";
      } else {
        printing = "recto-verso";
      }
    } else if (printingUI === "recto" || printingUI === "recto-verso") {
      printing = printingUI;
    }
  }

  const back_colors = printing === "recto-verso" ? 4 : 0;

  // Construction objet normalise. Les undefined ne sont pas inseres pour
  // laisser extractInitialOptions appliquer ses defauts si necessaire.
  const out: Record<string, any> = {};
  if (typeof quantity === "number") out.quantity = quantity;
  if (format) out.format = format;
  if (typeof width === "number") out.width = width;
  if (typeof height === "number") out.height = height;
  if (paper) out.papers = [paper];
  out.finishing_front = finishing_front;
  out.finishing_back = finishing_back;
  if (printing) {
    out.printing = printing;
    out.back_colors = back_colors;
  }

  // Preservation des champs immuables Clariprint pour buildClariprintPayload
  // (`kind`, `folds`, `binding`, `pages`, `front_colors`).
  for (const k of ["kind", "folds", "binding", "pages", "front_colors"]) {
    if (raw[k] != null && out[k] == null) {
      out[k] = raw[k];
    }
  }

  return out;
}

/**
 * Formate un montant HT en EUR locale FR par defaut : "1 234,56 EUR".
 * Defensif : NaN/Infinity/null retourne "—".
 */
export function formatEuro(
  priceHT: number | null | undefined,
  locale = "fr-FR",
): string {
  if (
    priceHT == null ||
    typeof priceHT !== "number" ||
    !Number.isFinite(priceHT)
  ) {
    return "—";
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceHT);
}
