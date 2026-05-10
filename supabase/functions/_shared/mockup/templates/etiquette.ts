/**
 * Template SVG paramatrique pour produit type `etiquette` (Story S4.2, Epic 4).
 *
 * Layout : forme rectangulaire avec coins fortement arrondis (rx=24) -> rendu
 * "etiquette adhesive". Bordure pointillee 2px en `theming.primaryColor`
 * (stroke-dasharray) pour suggerer la decoupe. productName centre en font
 * Inter 600. Pictogramme geometrique (cercle + barre horizontale) en haut
 * pour suggerer un logo / code-barres mock.
 *
 * Cas d usage Clariprint typique : 60x40 mm rectangulaire OU 50x50 mm carre.
 * Pas de svgdom, string templating direct.
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import { escapeXml, truncate } from "./_shared.ts";

const VIEWBOX = 1024;
const SHAPE_AREA_MAX = 720;
const TEXT_MAX_LEN = 22;

export function etiquetteSvg(specs: ProductSpecs, theming: ShopTheming): string {
  const aspect = specs.width / specs.height;
  const isPortrait = aspect < 1;
  const rectW = isPortrait ? SHAPE_AREA_MAX * aspect : SHAPE_AREA_MAX;
  const rectH = isPortrait ? SHAPE_AREA_MAX : SHAPE_AREA_MAX / aspect;
  const cx = (VIEWBOX - rectW) / 2;
  const cy = (VIEWBOX - rectH) / 2;

  // Pictogramme haut (cercle + barre horizontale)
  const pictoCx = cx + rectW / 2;
  const pictoCy = cy + rectH * 0.28;
  const pictoR = Math.min(rectW, rectH) * 0.08;
  const barW = rectW * 0.35;
  const barX = pictoCx - barW / 2;
  const barY = pictoCy + pictoR + 16;

  // productName en bas-centre
  const textY = cy + rectH * 0.7;

  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.18"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="${safeColor}" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" fill="#FAFAFA" stroke="${safeColor}" stroke-width="2" stroke-dasharray="6 4" rx="24" ry="24" filter="url(#shadow)"/>
  <circle cx="${pictoCx}" cy="${pictoCy}" r="${pictoR}" fill="none" stroke="${safeColor}" stroke-width="3"/>
  <rect x="${barX}" y="${barY}" width="${barW}" height="6" fill="${safeColor}" opacity="0.7" rx="3"/>
  <text x="${VIEWBOX / 2}" y="${textY}" text-anchor="middle" font-family="Inter" font-size="42" font-weight="600" fill="${safeColor}">${safeName}</text>
</svg>`;
}
