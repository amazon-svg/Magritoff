/**
 * Helpers partages entre les templates SVG mockup (Story S4.2, Epic 4).
 *
 * Extraits de flyer.ts (S4.1b) pour eviter la duplication entre les 5
 * templates MVP : flyer, carteVisite, brochure, etiquette, kakemono.
 */

/**
 * Echappe les caracteres XML/SVG dangereux dans une string.
 * Defense en profondeur contre une injection SVG via productName ou tout
 * autre champ user-controlled inject dans un template.
 */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Tronque une string a maxLen caracteres avec ellipsis (3 dots) si trop longue.
 * Utile pour assurer que productName tient dans le layout fixe d un mockup.
 */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 3)) + "...";
}
