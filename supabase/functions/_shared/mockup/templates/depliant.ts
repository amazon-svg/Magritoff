/**
 * Template SVG paramètrique pour produit type `depliant` (P15, 2026-06-16).
 *
 * Layout : 3 volets dépliés en perspective légère (effet ouverture A4 plié
 * en 3). Inspiré du screenshot Arnaud (référence brochure 3 volets dépliés
 * avec design interne hexagonal).
 *
 * Composition :
 *   - 3 panneaux côte à côte, avec lignes de pli verticales visibles
 *   - Skew léger sur les volets latéraux pour effet 3D (perspective dépliée)
 *   - Volet central : marquage Magrit (marguerite + Magrit + tagline)
 *   - Volets latéraux : mock content (formes pastel + lignes de texte)
 *   - Liseré pollen tout en bas (signature couleur Magrit)
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import { escapeXml, photoRealisticDefs, truncate } from "./_shared.ts";

const VIEWBOX = 1024;
const TEXT_MAX_LEN = 32;

const MAGRIT_TILE_FROM = "#E5F0FC";
const MAGRIT_TILE_TO = "#B7D3F2";
const MAGRIT_POLLEN_LIGHT = "#FFE066";
const MAGRIT_POLLEN_MID = "#F5B529";
const MAGRIT_POLLEN_DARK = "#C68708";
const MAGRIT_INK = "#0F172A";

function daisyMagrit(cx: number, cy: number, scale: number, coreGradientId: string): string {
  const petals = Array.from({ length: 18 }, (_, i) => {
    const angle = i * 20;
    return `<ellipse cx="0" cy="${-26 * scale}" rx="${3.5 * scale}" ry="${16 * scale}" transform="rotate(${angle})"/>`;
  }).join("");
  return `<g transform="translate(${cx} ${cy})">
    <g fill="#FFFFFF">${petals}</g>
    <circle r="${11 * scale}" fill="url(#${coreGradientId})"/>
  </g>`;
}

export function depliantSvg(specs: ProductSpecs, theming: ShopTheming): string {
  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  // Géométrie 3 volets côte à côte (paysage A4 ouvert) :
  // Chaque volet ~270px de large, avec 4px de pli entre.
  const panelW = 270;
  const panelH = 540;
  const gap = 4;
  const totalW = panelW * 3 + gap * 2;
  const startX = (VIEWBOX - totalW) / 2;
  const startY = (VIEWBOX - panelH) / 2;

  const leftX = startX;
  const midX = startX + panelW + gap;
  const rightX = startX + (panelW + gap) * 2;

  // Marguerite centrée sur le volet central
  const flowerCX = midX + panelW / 2;
  const flowerCY = startY + panelH * 0.38;
  const flowerScale = 1.4;

  // Textes volet central
  const titleY = flowerCY + 70;
  const taglineY = titleY + 24;
  const refY = startY + panelH - 28;

  // Mock lines volets latéraux
  const mockLines = (xBase: number, accent: string) => {
    let result = `<rect x="${xBase + 20}" y="${startY + 60}" width="${panelW - 40}" height="60" fill="${accent}" opacity="0.18" rx="3"/>`;
    for (let i = 0; i < 5; i++) {
      const lineY = startY + 150 + i * 38;
      const widthRatio = i % 2 === 0 ? 0.85 : 0.65;
      result += `<rect x="${xBase + 20}" y="${lineY}" width="${(panelW - 40) * widthRatio}" height="6" fill="${MAGRIT_INK}" opacity="${i === 0 ? 0.42 : 0.25}" rx="2"/>`;
    }
    return result;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.14"/>
    </linearGradient>
    <linearGradient id="mgTileCenter" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${MAGRIT_TILE_FROM}"/>
      <stop offset="100%" stop-color="${MAGRIT_TILE_TO}"/>
    </linearGradient>
    <radialGradient id="mgCoreDepliant" cx="45%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${MAGRIT_POLLEN_LIGHT}"/>
      <stop offset="70%" stop-color="${MAGRIT_POLLEN_MID}"/>
      <stop offset="100%" stop-color="${MAGRIT_POLLEN_DARK}"/>
    </radialGradient>
    ${photoRealisticDefs(safeColor)}
  </defs>

  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>

  <!-- Volet gauche (slight shadow) -->
  <rect x="${leftX}" y="${startY}" width="${panelW}" height="${panelH}" fill="url(#paperTexture)" stroke="${safeColor}" stroke-width="1.5" rx="4" filter="url(#shadowDouble)"/>
  <rect x="${leftX}" y="${startY}" width="${panelW}" height="${panelH}" fill="url(#paperHighlight)" rx="4" opacity="0.5" pointer-events="none"/>
  ${mockLines(leftX, MAGRIT_POLLEN_MID)}

  <!-- Volet droit (slight shadow) -->
  <rect x="${rightX}" y="${startY}" width="${panelW}" height="${panelH}" fill="url(#paperTexture)" stroke="${safeColor}" stroke-width="1.5" rx="4" filter="url(#shadowDouble)"/>
  <rect x="${rightX}" y="${startY}" width="${panelW}" height="${panelH}" fill="url(#paperHighlight)" rx="4" opacity="0.5" pointer-events="none"/>
  ${mockLines(rightX, MAGRIT_TILE_TO)}

  <!-- Volet central (tile Magrit + marguerite) -->
  <rect x="${midX}" y="${startY}" width="${panelW}" height="${panelH}" fill="url(#mgTileCenter)" stroke="${safeColor}" stroke-width="1.5" rx="4" filter="url(#shadowDouble)"/>
  <rect x="${midX}" y="${startY}" width="${panelW}" height="${panelH}" fill="url(#paperHighlight)" rx="4" opacity="0.5" pointer-events="none"/>
  ${daisyMagrit(flowerCX, flowerCY, flowerScale, "mgCoreDepliant")}
  <text x="${flowerCX}" y="${titleY}" text-anchor="middle" font-family="Inter" font-size="40" font-weight="500" font-style="italic" fill="${MAGRIT_INK}" letter-spacing="-0.025em">Magrit</text>
  <text x="${flowerCX}" y="${taglineY}" text-anchor="middle" font-family="Inter" font-size="11" font-weight="400" fill="${MAGRIT_INK}" fill-opacity="0.60" letter-spacing="0.08em">IMPRIMERIE · IA</text>
  <text x="${flowerCX}" y="${refY}" text-anchor="middle" font-family="Inter" font-size="11" font-weight="500" fill="${MAGRIT_INK}" fill-opacity="0.50" letter-spacing="0.04em">${safeName}</text>

  <!-- Liseré pollen jaune bottom (signature couleur sur les 3 volets unifies) -->
  <rect x="${leftX}" y="${startY + panelH - 6}" width="${totalW}" height="6" fill="${MAGRIT_POLLEN_MID}" opacity="0.85"/>
</svg>`;
}
