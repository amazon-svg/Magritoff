/**
 * Template SVG paramatrique pour produit type `flyer` (Story S4.1b, Epic 4).
 *
 * Genere une string SVG 1024x1024 avec :
 *  - Background : gradient + pattern de points en couleur `theming.primaryColor`
 *  - Rectangle "produit" centre, dimensions respectant le ratio width/height
 *    des specs Clariprint (portrait/paysage)
 *  - Texte productName en bas, font Inter (incluse dans resvg_wasm), couleur
 *    `theming.primaryColor`
 *
 * Securite : `escapeXml(productName)` empeche l'injection SVG si le user input
 * est non-sanitized en amont (defense en profondeur).
 *
 * Pas de manipulation DOM, pas de svgdom : pur string templating TypeScript.
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import { escapeXml, truncate } from "./_shared.ts";

const VIEWBOX = 1024;
const RECT_AREA_MAX = 700; // taille max du rectangle produit dans le viewBox
const TEXT_MAX_LEN = 30;

/**
 * Genere le SVG du template flyer en string.
 * Pas d'effet de bord, deterministe pour les memes inputs (snapshot-friendly).
 */
export function flyerSvg(specs: ProductSpecs, theming: ShopTheming): string {
  const aspect = specs.width / specs.height;
  // Calcul des dimensions du rectangle produit dans le viewBox 1024x1024.
  // Limite a RECT_AREA_MAX (700) pour laisser de la marge autour.
  const isPortrait = aspect < 1;
  const rectW = isPortrait ? RECT_AREA_MAX * aspect : RECT_AREA_MAX;
  const rectH = isPortrait ? RECT_AREA_MAX : RECT_AREA_MAX / aspect;
  const cx = (VIEWBOX - rectW) / 2;
  const cy = (VIEWBOX - rectH) / 2 - 40; // legerement remonte pour laisser place au texte
  const textY = cy + rectH + 80;

  // Tronquer le productName si trop long (preserve la lisibilite + securite layout).
  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.28"/>
    </linearGradient>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="12" cy="12" r="1.5" fill="${safeColor}" opacity="0.35"/>
    </pattern>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="${safeColor}" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#dots)"/>
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" fill="white" stroke="${safeColor}" stroke-width="3" rx="8" ry="8" filter="url(#shadow)"/>
  <text x="${VIEWBOX / 2}" y="${textY}" text-anchor="middle" font-family="Inter" font-size="48" font-weight="600" fill="${safeColor}">${safeName}</text>
</svg>`;
}
