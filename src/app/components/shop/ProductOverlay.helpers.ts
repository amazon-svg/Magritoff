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
  "85x55": { width: 85, height: 55 },
  "210x210": { width: 210, height: 210 },
};

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
