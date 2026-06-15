/**
 * A4.2 — Pairings curated heading/body pour personnalisation boutique.
 *
 * 5 pairings préchargés via Google Fonts dans `index.html` (sauf `system`
 * qui n'a pas besoin de fetch externe). L'admin tenant choisit dans un
 * dropdown limité — pas de free font picker pour cadrer la qualité
 * visuelle et éviter les frais de chargement multiples.
 *
 * Stratégie de fallback : si la clé stockée en DB n'est plus dans la
 * liste (ex: pairing déprécié), on retombe sur `system`.
 */

export interface FontPairing {
  /** Clé stable persistée dans shops.theme.fontPairing. */
  key: string;
  /** Label FR affiché dans le dropdown admin tenant. */
  label: string;
  /** Stack CSS pour les titres (heading). */
  heading: string;
  /** Stack CSS pour le texte courant (body). */
  body: string;
}

export const FONT_PAIRINGS: readonly FontPairing[] = [
  {
    key: "system",
    label: "Système (par défaut)",
    heading: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    body: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    key: "modern",
    label: "Moderne — Inter",
    heading: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  {
    key: "editorial",
    label: "Éditorial — Lora + Inter",
    heading: "'Lora', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
  },
  {
    key: "luxury",
    label: "Luxe — Playfair Display + Lato",
    heading: "'Playfair Display', Georgia, serif",
    body: "'Lato', system-ui, sans-serif",
  },
  {
    key: "technical",
    label: "Technique — Roboto Slab + Roboto",
    heading: "'Roboto Slab', Georgia, serif",
    body: "'Roboto', system-ui, sans-serif",
  },
] as const;

/** Pairing par défaut (clé `system`). Utilisé comme fallback. */
export const DEFAULT_FONT_PAIRING: FontPairing = FONT_PAIRINGS[0];

/**
 * Résout un pairing par sa clé. Retourne le pairing `system` si la clé
 * est absente, vide, ou non reconnue (pairing déprécié en DB).
 */
export function resolveFontPairing(key: string | null | undefined): FontPairing {
  if (!key || typeof key !== "string") return DEFAULT_FONT_PAIRING;
  const found = FONT_PAIRINGS.find((p) => p.key === key);
  return found ?? DEFAULT_FONT_PAIRING;
}
