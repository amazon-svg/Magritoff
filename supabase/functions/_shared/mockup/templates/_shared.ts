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

/**
 * S-PIM-VISUELS-6 (Sprint 7, 2026-06-01) : defs SVG photo-realistic communes.
 *
 * Defs reusables par les 5 templates pour donner un rendu plus realiste :
 *   - double drop-shadow (close-tight + far-soft) = profondeur naturelle
 *   - paperHighlight = gradient blanc top->transparent qui simule la lumiere
 *     sur le haut du papier (effet pellicule brillante subtile)
 *   - paperTexture = pattern micro-points blancs ultra-subtils (grain papier)
 *
 * Usage : injecter `${photoRealisticDefs(safeColor)}` dans le <defs> du
 * template, puis appliquer filter="url(#shadowDouble)" sur le rect produit
 * + ajouter <rect ... fill="url(#paperHighlight)"/> au-dessus du rect blanc
 * pour le highlight, et <rect ... fill="url(#paperTexture)"/> pour le grain.
 */
export function photoRealisticDefs(safeColor: string): string {
  return `
    <filter id="shadowDouble" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.18"/>
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="${safeColor}" flood-opacity="0.22"/>
    </filter>
    <linearGradient id="paperHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="35%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <pattern id="paperTexture" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="white"/>
      <circle cx="1" cy="1" r="0.3" fill="#e5e5e5" opacity="0.6"/>
      <circle cx="4" cy="3" r="0.25" fill="#e5e5e5" opacity="0.5"/>
    </pattern>`;
}

/**
 * Rectangle "produit" photo-realistic standard : fill texture papier subtile
 * + highlight gradient overlay + stroke en primaryColor + filter double-shadow.
 *
 * @param cx coin x du rectangle
 * @param cy coin y du rectangle
 * @param w largeur
 * @param h hauteur
 * @param rx radius coins (8 flyer, 16 carteVisite, etc.)
 * @param safeColor primaryColor escape
 */
export function photoRealisticProductRect(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rx: number,
  safeColor: string,
): string {
  return `
  <rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="url(#paperTexture)" stroke="${safeColor}" stroke-width="2" rx="${rx}" ry="${rx}" filter="url(#shadowDouble)"/>
  <rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="url(#paperHighlight)" rx="${rx}" ry="${rx}" pointer-events="none"/>`;
}
