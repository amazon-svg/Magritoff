/**
 * Template SVG paramatrique pour produit type `brochure` (Story S4.2, Epic 4).
 *
 * Layout : 2 panneaux cote a cote (effet plie / depliant) dans le viewBox
 * 1024x1024.
 *  - Panneau gauche (couverture) : pattern de points dense en
 *    `theming.primaryColor` + productName grand au centre (font Inter 700).
 *  - Panneau droit (4eme de couverture) : lignes horizontales fines
 *    paralleles (effet "texte mock") + degrade vertical bas.
 *  - Leger decalage vertical entre les 2 panneaux pour suggerer la perspective
 *    plie (pli central visible).
 *
 * Cas d usage Clariprint typique : A4 ou A5 plie 2 volets.
 * Pas de svgdom, string templating direct.
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import { escapeXml, truncate } from "./_shared.ts";

const VIEWBOX = 1024;
const PANEL_AREA_MAX = 760; // hauteur max d un panneau (chacun pleine hauteur)
const TEXT_MAX_LEN = 26;

export function brochureSvg(specs: ProductSpecs, theming: ShopTheming): string {
  // Brochure : on rend 2 panneaux portrait cote a cote. Le ratio panel respecte
  // specs (apres pliage : panel = width/2 x height pour A4 ouvert paysage).
  // Pour le visuel mockup, on prend ratio specs comme proportions de chaque panel.
  const aspect = Math.min(specs.width, specs.height) / Math.max(specs.width, specs.height);
  const panelH = PANEL_AREA_MAX;
  const panelW = panelH * aspect; // chaque panel est portrait
  const totalW = panelW * 2 + 12; // 12px de pli central
  const startX = (VIEWBOX - totalW) / 2;
  const cy = (VIEWBOX - panelH) / 2;
  const leftX = startX;
  const rightX = startX + panelW + 12;

  const textY = cy + panelH / 2;
  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  // Pre-genere les lignes mock-text du panel droit (8 lignes uniformes).
  let mockLines = "";
  for (let i = 0; i < 8; i++) {
    const lineY = cy + 100 + i * 56;
    const lineW = panelW * (i % 2 === 0 ? 0.7 : 0.85) - 40;
    mockLines += `\n    <rect x="${rightX + 20}" y="${lineY}" width="${lineW}" height="6" fill="${safeColor}" opacity="0.35" rx="3"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.22"/>
    </linearGradient>
    <pattern id="dotsCover" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="1.6" fill="${safeColor}" opacity="0.45"/>
    </pattern>
    <linearGradient id="backFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.18"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="${safeColor}" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  <rect x="${leftX}" y="${cy}" width="${panelW}" height="${panelH}" fill="white" stroke="${safeColor}" stroke-width="2" rx="6" filter="url(#shadow)"/>
  <rect x="${leftX}" y="${cy}" width="${panelW}" height="${panelH}" fill="url(#dotsCover)" rx="6"/>
  <rect x="${rightX}" y="${cy}" width="${panelW}" height="${panelH}" fill="url(#backFade)" stroke="${safeColor}" stroke-width="2" rx="6" filter="url(#shadow)"/>
  ${mockLines}
  <text x="${leftX + panelW / 2}" y="${textY}" text-anchor="middle" font-family="Inter" font-size="48" font-weight="700" fill="${safeColor}">${safeName}</text>
</svg>`;
}
