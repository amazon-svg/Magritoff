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
import {
  escapeXml,
  photoRealisticDefs,
  photoRealisticProductRect,
  truncate,
} from "./_shared.ts";

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

  const isBack = theming.view === 'back';
  // Vue 'back' carte de visite : pas de liseret central, juste 3 lignes de
  // texte mock (effet "coordonnées personnelles au dos"). Identique en
  // taille/position de carte.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.32"/>
    </linearGradient>
    ${photoRealisticDefs(safeColor)}
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  ${photoRealisticProductRect(cx, cy, rectW, rectH, 16, safeColor)}
  ${isBack
    ? `<rect x="${cx + rectW * 0.15}" y="${cy + rectH * 0.30}" width="${rectW * 0.7}" height="8" fill="${safeColor}" opacity="0.40" rx="3"/>
       <rect x="${cx + rectW * 0.15}" y="${cy + rectH * 0.45}" width="${rectW * 0.55}" height="6" fill="${safeColor}" opacity="0.30" rx="3"/>
       <rect x="${cx + rectW * 0.15}" y="${cy + rectH * 0.58}" width="${rectW * 0.65}" height="6" fill="${safeColor}" opacity="0.30" rx="3"/>
       <text x="${VIEWBOX / 2}" y="${cy + rectH - 24}" text-anchor="middle" font-family="Inter" font-size="22" font-weight="400" fill="${safeColor}" opacity="0.5">Verso</text>`
    : `<rect x="${liseretX}" y="${liseretY}" width="${liseretW}" height="4" fill="${safeColor}" rx="2"/>
       <text x="${VIEWBOX / 2}" y="${textY}" text-anchor="middle" font-family="Inter" font-size="56" font-weight="700" fill="${safeColor}">${safeName}</text>`}
</svg>`;
}
