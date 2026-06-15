/**
 * Template SVG paramètrique pour produit type `brochure`.
 *
 * Refonte 2026-06-15 (P3-VISUELS) : design Magrit-brandé.
 * Layout : 2 panneaux côte à côte (effet plié / dépliant) — couverture + 4e.
 *   - Panneau gauche (couverture) : tile bleu pastel + grande marguerite +
 *     "Magrit" italic + sous-titre productName en réf + liseré pollen.
 *   - Panneau droit (4e couverture) : surface papier + lignes mock + contact
 *     simulé + tagline.
 *
 * Cas d usage Clariprint typique : A4 ou A5 plié 2 volets.
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import {
  escapeXml,
  photoRealisticDefs,
  photoRealisticProductRect,
  truncate,
} from "./_shared.ts";

const VIEWBOX = 1024;
const PANEL_AREA_MAX = 760;
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

export function brochureSvg(specs: ProductSpecs, theming: ShopTheming): string {
  const aspect = Math.min(specs.width, specs.height) / Math.max(specs.width, specs.height);
  const panelH = PANEL_AREA_MAX;
  const panelW = panelH * aspect;
  const totalW = panelW * 2 + 12;
  const startX = (VIEWBOX - totalW) / 2;
  const cy = (VIEWBOX - panelH) / 2;
  const leftX = startX;
  const rightX = startX + panelW + 12;

  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  // Couverture : marguerite + Magrit + référence
  const flowerCX = leftX + panelW / 2;
  const flowerCY = cy + panelH * 0.30;
  const flowerScale = Math.min(panelW, panelH) / 140;

  const coverTitleY = cy + panelH * 0.62;
  const coverTaglineY = coverTitleY + 30;
  const coverRefY = cy + panelH * 0.86;
  const coverLiseretY = cy + panelH - 8;
  const liseretH = 8;

  // 4e couverture : 6 lignes mock + contact + tagline
  let mockLines = "";
  for (let i = 0; i < 6; i++) {
    const lineY = cy + 80 + i * 56;
    const lineW = panelW * (i % 2 === 0 ? 0.75 : 0.88) - 40;
    mockLines += `<rect x="${rightX + 32}" y="${lineY}" width="${lineW}" height="6" fill="${MAGRIT_INK}" opacity="${i === 0 ? 0.45 : 0.25}" rx="2"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.16"/>
    </linearGradient>
    <linearGradient id="mgTileCover" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${MAGRIT_TILE_FROM}"/>
      <stop offset="100%" stop-color="${MAGRIT_TILE_TO}"/>
    </linearGradient>
    <radialGradient id="mgCoreCover" cx="45%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${MAGRIT_POLLEN_LIGHT}"/>
      <stop offset="70%" stop-color="${MAGRIT_POLLEN_MID}"/>
      <stop offset="100%" stop-color="${MAGRIT_POLLEN_DARK}"/>
    </radialGradient>
    <clipPath id="coverClip">
      <rect x="${leftX}" y="${cy}" width="${panelW}" height="${panelH}" rx="6" ry="6"/>
    </clipPath>
    ${photoRealisticDefs(safeColor)}
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  <rect x="${leftX}" y="${cy}" width="${panelW}" height="${panelH}" fill="url(#mgTileCover)" stroke="${safeColor}" stroke-width="2" rx="6" ry="6" filter="url(#shadowDouble)"/>
  <g clip-path="url(#coverClip)">
    ${daisyMagrit(flowerCX, flowerCY, flowerScale, "mgCoreCover")}
    <rect x="${leftX}" y="${coverLiseretY}" width="${panelW}" height="${liseretH}" fill="${MAGRIT_POLLEN_MID}"/>
  </g>
  <rect x="${leftX}" y="${cy}" width="${panelW}" height="${panelH}" fill="url(#paperHighlight)" rx="6" ry="6" opacity="0.5" pointer-events="none"/>
  <text x="${flowerCX}" y="${coverTitleY}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="56" font-weight="500" font-style="italic" fill="${MAGRIT_INK}" letter-spacing="-0.025em">Magrit</text>
  <text x="${flowerCX}" y="${coverTaglineY}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="14" font-weight="400" fill="${MAGRIT_INK}" fill-opacity="0.55" letter-spacing="0.08em">IMPRIMERIE · IA</text>
  <text x="${flowerCX}" y="${coverRefY}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="13" font-weight="400" fill="${MAGRIT_INK}" fill-opacity="0.50" letter-spacing="0.04em">${safeName}</text>
  ${photoRealisticProductRect(rightX, cy, panelW, panelH, 6, safeColor)}
  ${mockLines}
  <text x="${rightX + panelW / 2}" y="${cy + panelH - 40}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="13" font-weight="500" fill="${MAGRIT_INK}" fill-opacity="0.65" letter-spacing="0.06em">magrit.io · contact@magrit.io</text>
</svg>`;
}
