/**
 * Helpers purs pour ShopLayout (Story S2.1, Epic 2).
 *
 * Pattern repo : helpers logiques separes pour testabilite vitest sans
 * @testing-library/react (cf. MockupImage.helpers.ts).
 *
 * Surface :
 *  - resolveShopTheme(shop) -> { dataTheme: 'dark' | undefined, isDark: boolean }
 *      Decide du data-theme a poser sur le shop root. Dark par defaut
 *      (AC2, AC S2.1) ; light uniquement si shop.theme.mode === 'light'
 *      explicitement (retro-compat avec les boutiques deja configurees).
 *
 *  - resolveShopBrandStyle(shop) -> Record<string, string>
 *      Inline style pour exposer les CSS custom props --shop-primary et
 *      --shop-accent au shop root. Reprend la logique deja en place dans
 *      PublicShop.tsx pre-S2.1.
 *
 *  - shouldShowCartBadge(count) -> boolean
 *      True si count > 0. Helper trivial mais teste pour figer le contrat
 *      (AC1 : badge affiche quand cartCount > 0).
 */

import type { Shop } from "../../contexts/ShopsContext";
import { resolveFontPairing } from "./fontPairings";

export interface ShopThemeResolution {
  /** Valeur a poser sur l'attribut data-theme. undefined = pas d'attribut (light). */
  dataTheme: "dark" | undefined;
  /** True si dark mode applique. Pratique pour brancher des conditionnels UI. */
  isDark: boolean;
}

/**
 * Resolution dark mode (AC2 S2.1).
 *
 * Regle :
 *   - Si shop.theme.mode === 'light' (configure explicitement par le tenant)
 *     -> light mode (pas de data-theme).
 *   - Sinon (incluant 'dark' OU undefined OU autre) -> dark mode par defaut.
 *
 * Cette regle assume que les nouvelles boutiques herithent de DEFAULT_THEME
 * (mode='light' aujourd hui dans ShopsContext) — il faudra coordonner avec
 * une migration tenant pour basculer DEFAULT_THEME.mode en 'dark' OU
 * accepter qu une boutique cree avant le toggle reste en light tant que
 * l admin tenant ne la passe pas en dark explicitement.
 */
export function resolveShopTheme(
  shop: Pick<Shop, "theme"> | { theme?: { mode?: string } } | null | undefined,
): ShopThemeResolution {
  const mode = shop?.theme?.mode;
  if (mode === "light") {
    return { dataTheme: undefined, isDark: false };
  }
  return { dataTheme: "dark", isDark: true };
}

/**
 * Inline style pour CSS custom props brand (AC1 S2.1 + A4.2 extension).
 * @ts-expect-error attendu cote consommateur React (CSS custom props).
 *
 * A4.2 — Expose 5 nouvelles vars optionnelles quand définies en DB :
 *   --shop-secondary / --shop-text / --shop-bg (couleurs palette élargie)
 *   --shop-font-heading / --shop-font-body (pairing curated, fallback system).
 *
 * Les vars manquantes sont omises (pas de fallback inline) : le consommateur
 * CSS doit prévoir ses propres valeurs par défaut via `var(--shop-x, fallback)`.
 */
export function resolveShopBrandStyle(
  shop: Pick<Shop, "theme"> | null | undefined,
): Record<string, string> {
  if (!shop?.theme) return {};
  const out: Record<string, string> = {};
  if (shop.theme.primaryColor) {
    out["--shop-primary"] = shop.theme.primaryColor;
  }
  if (shop.theme.accentColor) {
    out["--shop-accent"] = shop.theme.accentColor;
  }
  if (shop.theme.secondaryColor) {
    out["--shop-secondary"] = shop.theme.secondaryColor;
  }
  if (shop.theme.textColor) {
    out["--shop-text"] = shop.theme.textColor;
  }
  if (shop.theme.bgColor) {
    out["--shop-bg"] = shop.theme.bgColor;
  }
  // Pairing fonts : on injecte les stacks heading/body même si la clé est
  // absente ou inconnue (resolveFontPairing fallback sur `system`). Permet
  // aux composants de consommer var(--shop-font-heading) sans condition.
  const pairing = resolveFontPairing(shop.theme.fontPairing);
  out["--shop-font-heading"] = pairing.heading;
  out["--shop-font-body"] = pairing.body;
  return out;
}

/** True si le badge cart count doit s afficher (AC1). */
export function shouldShowCartBadge(count: number | null | undefined): boolean {
  return typeof count === "number" && count > 0;
}

/**
 * A4.1 — True si la bannière hero doit être rendue avant le header sticky.
 * On exige une URL non vide (trim) ; tagline seul ne suffit pas (sans image
 * la bannière n'a pas d'identité visuelle).
 */
export function shouldRenderHeroBanner(
  shop: Pick<Shop, "hero_image_url"> | { hero_image_url?: string | null } | null | undefined,
): boolean {
  const url = shop?.hero_image_url;
  return typeof url === "string" && url.trim().length > 0;
}

/** A4.1 — Tagline normalisé pour overlay hero (trim + cap 120 char côté display). */
export function resolveHeroTagline(
  shop: Pick<Shop, "tagline"> | { tagline?: string | null } | null | undefined,
): string | null {
  const t = shop?.tagline;
  if (typeof t !== "string") return null;
  const trimmed = t.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > 120 ? trimmed.slice(0, 120) : trimmed;
}

/** Trim défensif d'une URL éventuelle (string non vide → valeur, sinon null). */
function cleanUrl(url: string | null | undefined): string | null {
  return typeof url === "string" && url.trim().length > 0 ? url.trim() : null;
}

/**
 * Bandeau de marque (2026-07-08, refonte hero — retour Arnaud).
 *
 * Remplace l'ancien hero « image étirée en fond ». Le bandeau est un espace
 * CO-BRANDÉ : couleur(s) de marque du client + logo client présenté proprement
 * (jamais étiré). On l'affiche dès qu'il y a une identité à montrer : un logo,
 * une image de fond OU une accroche (le nom de la boutique fait toujours office
 * de repli d'identité, donc le bandeau reste pertinent même sans logo).
 */
export function shouldRenderBrandBanner(
  shop:
    | Pick<Shop, "hero_image_url" | "logo_url" | "tagline">
    | { hero_image_url?: string | null; logo_url?: string | null; tagline?: string | null }
    | null
    | undefined,
): boolean {
  if (!shop) return false;
  return Boolean(
    cleanUrl(shop.hero_image_url) ||
      cleanUrl(shop.logo_url) ||
      resolveHeroTagline(shop as { tagline?: string | null }),
  );
}

export interface BrandBannerBackground {
  /** Style inline à poser sur le bandeau (image cover OU dégradé de marque). */
  style: Record<string, string>;
  /** True si une image de fond est utilisée → le consommateur ajoute un scrim. */
  hasImage: boolean;
}

/**
 * Fond du bandeau de marque :
 *  - image de fond fournie (`hero_image_url`) → cover/center (+ scrim côté UI) ;
 *  - sinon → dégradé bâti sur la couleur primaire de marque (`--shop-primary`),
 *    fondu vers un fond sombre pour la profondeur et la lisibilité du texte.
 * Toujours cohérent, jamais d'image logo étirée.
 */
export function resolveBrandBannerBackground(
  shop:
    | Pick<Shop, "hero_image_url">
    | { hero_image_url?: string | null }
    | null
    | undefined,
): BrandBannerBackground {
  const img = cleanUrl(shop?.hero_image_url);
  if (img) {
    return {
      style: {
        backgroundImage: `url(${img})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      },
      hasImage: true,
    };
  }
  return {
    style: {
      backgroundImage:
        "linear-gradient(120deg, var(--shop-primary, #1e3a8a) 0%, rgba(2, 6, 23, 0.72) 100%)",
    },
    hasImage: false,
  };
}
