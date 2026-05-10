/**
 * Template SVG paramatrique pour produit type `carteVisite` (Story S4.2, Epic 4).
 *
 * Layout : carte rectangle paysage (ratio respecte) centree dans le viewBox
 * 1024x1024, sur fond gradient diagonal en couleur `theming.primaryColor`.
 *  - Coins arrondis prononces (rx=16) -> rendu "carte de visite"
 *  - Ombre portee
 *  - productName en gros au centre (font Inter 700)
 *  - Lisere decoratif horizontal en bas de carte (4px en primaryColor)
 *
 * Cas d usage Clariprint typique : 85x55 mm (BVCard EU standard) ou 90x55 mm.
 * Pas de svgdom, string templating direct.
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import { escapeXml, truncate } from "./_shared.ts";

const VIEWBOX = 1024;
const RECT_AREA_MAX = 800; // carte plus large que flyer (800 vs 700)
const TEXT_MAX_LEN = 24;

export function carteVisiteSvg(specs: ProductSpecs, theming: ShopTheming): string {
  // BVCard est typiquement paysage. Si l'utilisateur passe portrait, on respecte
  // le ratio mais on inverse les dimensions pour garder la carte horizontale.
  const aspect = Math.max(specs.width, specs.height) / Math.min(specs.width, specs.height);
  // Carte toujours rendue paysage : largeur = max, hauteur = min
  const rectW = RECT_AREA_MAX;
  const rectH = RECT_AREA_MAX / aspect;
  const cx = (VIEWBOX - rectW) / 2;
  const cy = (VIEWBOX - rectH) / 2;
  const textY = cy + rectH / 2 + 12; // approximative center for text baseline
  const liseretY = cy + rectH - 36;
  const liseretW = rectW * 0.4;
  const liseretX = cx + (rectW - liseretW) / 2;

  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.32"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="${safeColor}" flood-opacity="0.30"/>
    </filter>
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" fill="white" stroke="${safeColor}" stroke-width="2" rx="16" ry="16" filter="url(#shadow)"/>
  <rect x="${liseretX}" y="${liseretY}" width="${liseretW}" height="4" fill="${safeColor}" rx="2"/>
  <text x="${VIEWBOX / 2}" y="${textY}" text-anchor="middle" font-family="Inter" font-size="56" font-weight="700" fill="${safeColor}">${safeName}</text>
</svg>`;
}
