/**
 * Template SVG paramatrique pour produit type `kakemono` (Story S4.2, Epic 4).
 *
 * Layout : rectangle tres portrait (ratio ~1:2.35) centre dans le viewBox
 * 1024x1024.
 *  - Pied "support" gris fonce en bas (suggere le pied d un roll-up).
 *  - 3 bandes horizontales decoratives en `theming.primaryColor` opacites
 *    decroissantes (effet hierarchie titre / sous-titre / footer).
 *  - productName en haut de la zone visible (header), font Inter 800 size 64.
 *  - Logo gradient (similaire ShopLayout S2.1) en haut a gauche.
 *
 * Cas d usage Clariprint typique : 850x2000 mm vertical (roll-up standard).
 * Pas de svgdom, string templating direct.
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import { escapeXml, truncate } from "./_shared.ts";

const VIEWBOX = 1024;
const SHAPE_HEIGHT_MAX = 880; // kakemono est tres haut
const FOOT_HEIGHT = 28; // pied du roll-up
const TEXT_MAX_LEN = 28;

export function kakemonoSvg(specs: ProductSpecs, theming: ShopTheming): string {
  // Kakemono : toujours portrait. Si l'utilisateur passe paysage, on inverse.
  const aspect = Math.min(specs.width, specs.height) / Math.max(specs.width, specs.height);
  const rectH = SHAPE_HEIGHT_MAX;
  const rectW = rectH * aspect; // typiquement etroit (ratio < 1)
  const cx = (VIEWBOX - rectW) / 2;
  const cy = (VIEWBOX - rectH) / 2;

  // Logo en haut a gauche (gradient)
  const logoSize = 56;
  const logoX = cx + 28;
  const logoY = cy + 28;

  // Bandes decoratives horizontales (3, opacite decroissante)
  const bandX = cx + 28;
  const bandW = rectW - 56;
  const band1Y = cy + 240;
  const band2Y = cy + 380;
  const band3Y = cy + 520;

  // ProductName en header (sous le logo)
  const textY = cy + 140;
  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  // Pied du roll-up (rectangle gris fonce sous la zone visible)
  const footW = rectW * 1.3;
  const footX = (VIEWBOX - footW) / 2;
  const footY = cy + rectH - FOOT_HEIGHT / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.20"/>
    </linearGradient>
    <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.6"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="${safeColor}" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" fill="white" stroke="${safeColor}" stroke-width="2" rx="4" filter="url(#shadow)"/>
  <rect x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" fill="url(#logoGrad)" rx="6"/>
  <text x="${cx + rectW / 2}" y="${textY}" text-anchor="middle" font-family="Inter" font-size="44" font-weight="800" fill="${safeColor}">${safeName}</text>
  <rect x="${bandX}" y="${band1Y}" width="${bandW}" height="14" fill="${safeColor}" opacity="0.55" rx="3"/>
  <rect x="${bandX}" y="${band2Y}" width="${bandW * 0.75}" height="10" fill="${safeColor}" opacity="0.40" rx="3"/>
  <rect x="${bandX}" y="${band3Y}" width="${bandW * 0.5}" height="8" fill="${safeColor}" opacity="0.30" rx="3"/>
  <rect x="${footX}" y="${footY}" width="${footW}" height="${FOOT_HEIGHT}" fill="#2A2A2D" rx="6"/>
</svg>`;
}
