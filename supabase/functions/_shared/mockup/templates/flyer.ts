/**
 * Template SVG paramètrique pour produit type `flyer`.
 *
 * Refonte 2026-06-15 (P3-VISUELS) : design Magrit-brandé réaliste.
 * Layout portrait composé en 3 zones verticales :
 *   - Haut (35%) : bandeau tile bleu pastel + grande marguerite Magrit
 *   - Milieu (45%) : surface papier avec "Magrit" italic + tagline + 4 lignes de
 *     texte simulé (corps article promo)
 *   - Bas (20%) : ligne contact + référence + liseré pollen
 *
 * Verso : tile complet + marguerite centrée + signature "Magrit".
 *
 * Constantes brand Magrit (cf. carteVisite.ts pour la cohérence).
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import {
  escapeXml,
  photoRealisticDefs,
  photoRealisticProductRect,
  truncate,
} from "./_shared.ts";

const VIEWBOX = 1024;
const RECT_AREA_MAX = 700;
const TEXT_MAX_LEN = 40;

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

export function flyerSvg(specs: ProductSpecs, theming: ShopTheming): string {
  const aspect = specs.width / specs.height;
  const isPortrait = aspect < 1;
  const rectW = isPortrait ? RECT_AREA_MAX * aspect : RECT_AREA_MAX;
  const rectH = isPortrait ? RECT_AREA_MAX : RECT_AREA_MAX / aspect;
  const cx = (VIEWBOX - rectW) / 2;
  const cy = (VIEWBOX - rectH) / 2;

  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  const isBack = theming.view === "back";

  // VERSO : tile complète + marguerite + signature
  if (isBack) {
    const backFlowerCX = cx + rectW / 2;
    const backFlowerCY = cy + rectH * 0.45;
    const backFlowerScale = Math.min(rectW, rectH) / 120;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.16"/>
    </linearGradient>
    <linearGradient id="mgTileBack" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${MAGRIT_TILE_FROM}"/>
      <stop offset="100%" stop-color="${MAGRIT_TILE_TO}"/>
    </linearGradient>
    <radialGradient id="mgCoreBack" cx="45%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${MAGRIT_POLLEN_LIGHT}"/>
      <stop offset="70%" stop-color="${MAGRIT_POLLEN_MID}"/>
      <stop offset="100%" stop-color="${MAGRIT_POLLEN_DARK}"/>
    </radialGradient>
    ${photoRealisticDefs(safeColor)}
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" fill="url(#mgTileBack)" rx="8" ry="8" filter="url(#shadowDouble)"/>
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" fill="url(#paperHighlight)" rx="8" ry="8" opacity="0.6" pointer-events="none"/>
  ${daisyMagrit(backFlowerCX, backFlowerCY, backFlowerScale, "mgCoreBack")}
  <text x="${backFlowerCX}" y="${cy + rectH * 0.78}" text-anchor="middle" font-family="Inter" font-size="44" font-weight="500" font-style="italic" fill="${MAGRIT_INK}" letter-spacing="-0.02em">Magrit</text>
  <text x="${backFlowerCX}" y="${cy + rectH * 0.85}" text-anchor="middle" font-family="Inter" font-size="14" font-weight="400" fill="${MAGRIT_INK}" fill-opacity="0.55" letter-spacing="0.08em">IMPRIMERIE · IA</text>
</svg>`;
  }

  // RECTO : 3 zones verticales
  const zone1H = rectH * 0.35; // bandeau tile + marguerite
  const flowerCX = cx + rectW / 2;
  const flowerCY = cy + zone1H / 2;
  const flowerScale = Math.min(rectW, zone1H) / 120;

  // Zone 2 : textes
  const titleY = cy + zone1H + 70;
  const taglineY = titleY + 24;
  const corps1Y = titleY + 80;
  const lineGap = 28;

  // Zone 3 : contact + liseré
  const contactY = cy + rectH - 70;
  const liseretY = cy + rectH - 8;
  const liseretH = 8;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.16"/>
    </linearGradient>
    <linearGradient id="mgTileBand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${MAGRIT_TILE_FROM}"/>
      <stop offset="100%" stop-color="${MAGRIT_TILE_TO}"/>
    </linearGradient>
    <radialGradient id="mgCoreBand" cx="45%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${MAGRIT_POLLEN_LIGHT}"/>
      <stop offset="70%" stop-color="${MAGRIT_POLLEN_MID}"/>
      <stop offset="100%" stop-color="${MAGRIT_POLLEN_DARK}"/>
    </radialGradient>
    <clipPath id="flyerClip">
      <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" rx="8" ry="8"/>
    </clipPath>
    ${photoRealisticDefs(safeColor)}
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  ${photoRealisticProductRect(cx, cy, rectW, rectH, 8, safeColor)}
  <g clip-path="url(#flyerClip)">
    <rect x="${cx}" y="${cy}" width="${rectW}" height="${zone1H}" fill="url(#mgTileBand)"/>
    ${daisyMagrit(flowerCX, flowerCY, flowerScale, "mgCoreBand")}
    <rect x="${cx}" y="${liseretY}" width="${rectW}" height="${liseretH}" fill="${MAGRIT_POLLEN_MID}"/>
  </g>
  <text x="${flowerCX}" y="${titleY}" text-anchor="middle" font-family="Inter" font-size="44" font-weight="700" fill="${MAGRIT_INK}" letter-spacing="-0.025em">${safeName}</text>
  <text x="${flowerCX}" y="${taglineY}" text-anchor="middle" font-family="Inter" font-size="14" font-weight="500" font-style="italic" fill="${MAGRIT_INK}" fill-opacity="0.60" letter-spacing="-0.01em">by Magrit · imprimerie augmentée par l'IA</text>
  <rect x="${cx + 60}" y="${corps1Y - 16}" width="${rectW - 120}" height="6" fill="${MAGRIT_INK}" opacity="0.30" rx="2"/>
  <rect x="${cx + 60}" y="${corps1Y - 16 + lineGap}" width="${(rectW - 120) * 0.85}" height="6" fill="${MAGRIT_INK}" opacity="0.22" rx="2"/>
  <rect x="${cx + 60}" y="${corps1Y - 16 + lineGap * 2}" width="${(rectW - 120) * 0.9}" height="6" fill="${MAGRIT_INK}" opacity="0.22" rx="2"/>
  <rect x="${cx + 60}" y="${corps1Y - 16 + lineGap * 3}" width="${(rectW - 120) * 0.55}" height="6" fill="${MAGRIT_INK}" opacity="0.22" rx="2"/>
  <text x="${cx + rectW / 2}" y="${contactY}" text-anchor="middle" font-family="Inter" font-size="13" font-weight="500" fill="${MAGRIT_INK}" fill-opacity="0.65" letter-spacing="0.06em">magrit.io · contact@magrit.io</text>
</svg>`;
}
