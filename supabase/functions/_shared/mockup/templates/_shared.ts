/**
 * Helpers partages entre les templates SVG mockup (Story S4.2, Epic 4).
 *
 * P16 (2026-06-16) : ajout de daisyMagrit + extension photoRealisticDefs
 * avec magritPollen + magritTileGrad pour les templates depliant + etiquette
 * (refonte visuelle Gemini). Les autres templates restent intacts.
 */

/**
 * Echappe les caracteres XML/SVG dangereux dans une string.
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
 * Tronque une string a maxLen caracteres avec ellipsis si trop longue.
 */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 3)) + "...";
}

/**
 * Defs SVG photo-realistic communes (S-PIM-VISUELS-6 Sprint 7 + extension P16).
 *
 * Contient :
 *   - shadowDouble  : double drop-shadow profondeur naturelle
 *   - paperHighlight: gradient blanc top->transparent (lumiere papier)
 *   - paperTexture  : pattern micro-points (grain papier)
 *   - magritPollen  : radial gradient coeur pollen marguerite Magrit (P16)
 *   - magritTileGrad: linear gradient tile bleu pastel Magrit (P16)
 *
 * Usage : injecter `${photoRealisticDefs(safeColor)}` dans le <defs> du template.
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
 * Defs gradients Magrit identitaires (P16) — coeur pollen + tile bleu pastel.
 *
 * Isole des photoRealisticDefs pour ne pas modifier le SVG des templates qui
 * n en ont pas besoin (flyer, carteVisite, brochure, kakemono, packaging).
 * Utilise par depliant + etiquette (P16 Gemini) qui referencent
 * `url(#magritPollen)` via daisyMagrit + `url(#magritTileGrad)` pour le tile.
 */
export function magritGradientsDefs(): string {
  return `
    <radialGradient id="magritPollen" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFE066"/>
      <stop offset="60%" stop-color="#F5B529"/>
      <stop offset="100%" stop-color="#C68708"/>
    </radialGradient>
    <linearGradient id="magritTileGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E5F0FC"/>
      <stop offset="100%" stop-color="#B7D3F2"/>
    </linearGradient>`;
}

/**
 * Rectangle "produit" photo-realistic standard.
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

/**
 * Marguerite Magrit standard (P16) — 18 petales blancs + coeur pollen.
 *
 * Reference l ID radial gradient `magritPollen` defini par photoRealisticDefs.
 * Utilise par depliant.ts + etiquette.ts (refonte P16 Gemini).
 *
 * @param cx coordonnee X du centre
 * @param cy coordonnee Y du centre
 * @param scale facteur d echelle (1.0 = taille de reference 26+11px)
 */
export function daisyMagrit(cx: number, cy: number, scale: number): string {
  const petals = Array.from(
    { length: 18 },
    (_, i) =>
      `<ellipse cx="0" cy="${-26 * scale}" rx="${3.5 * scale}" ry="${16 * scale}" transform="rotate(${i * 20})"/>`,
  ).join("");
  return `<g transform="translate(${cx} ${cy})"><g fill="#FFFFFF">${petals}</g><circle r="${11 * scale}" fill="url(#magritPollen)"/></g>`;
}
