/**
 * Template SVG paramètrique pour produit type `etiquette`.
 *
 * Refonte 2026-06-15 (P3-VISUELS) : design Magrit-brandé compact.
 * Layout (étiquette est petite — design ramassé) :
 *   - Fond tile bleu pastel sur toute l'étiquette
 *   - Marguerite Magrit centrée + "Magrit" italic dessous + petit tagline
 *   - Bordure dashed conservée (suggère la découpe adhésive)
 *   - Liseré pollen tout en bas
 *
 * Cas d usage Clariprint typique : 60x40 mm rectangulaire OU 50x50 mm carré.
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import { escapeXml, photoRealisticDefs, truncate } from "./_shared.ts";

const VIEWBOX = 1024;
const SHAPE_AREA_MAX = 720;
const TEXT_MAX_LEN = 22;

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

export function etiquetteSvg(specs: ProductSpecs, theming: ShopTheming): string {
  const aspect = specs.width / specs.height;
  const isPortrait = aspect < 1;
  const rectW = isPortrait ? SHAPE_AREA_MAX * aspect : SHAPE_AREA_MAX;
  const rectH = isPortrait ? SHAPE_AREA_MAX : SHAPE_AREA_MAX / aspect;
  const cx = (VIEWBOX - rectW) / 2;
  const cy = (VIEWBOX - rectH) / 2;

  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  // Marguerite centrée (zone supérieure de l'étiquette)
  const flowerCX = cx + rectW / 2;
  const flowerCY = cy + rectH * 0.38;
  const flowerScale = Math.min(rectW, rectH) / 150;

  const titleY = cy + rectH * 0.70;
  const taglineY = titleY + 24;
  const refY = cy + rectH * 0.88;
  const liseretY = cy + rectH - 8;
  const liseretH = 8;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.16"/>
    </linearGradient>
    <linearGradient id="mgTileEtiq" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${MAGRIT_TILE_FROM}"/>
      <stop offset="100%" stop-color="${MAGRIT_TILE_TO}"/>
    </linearGradient>
    <radialGradient id="mgCoreEtiq" cx="45%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${MAGRIT_POLLEN_LIGHT}"/>
      <stop offset="70%" stop-color="${MAGRIT_POLLEN_MID}"/>
      <stop offset="100%" stop-color="${MAGRIT_POLLEN_DARK}"/>
    </radialGradient>
    <clipPath id="etiqClip">
      <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" rx="24" ry="24"/>
    </clipPath>
    ${photoRealisticDefs(safeColor)}
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  <!-- P15 etiquette refonte : bordure dashed plus epaisse + ombre portee marquee (effet sticker decolle) -->
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" fill="url(#mgTileEtiq)" stroke="${safeColor}" stroke-width="3" stroke-dasharray="10 6" rx="32" ry="32" filter="url(#shadowDouble)"/>
  <g clip-path="url(#etiqClip)">
    ${daisyMagrit(flowerCX, flowerCY, flowerScale, "mgCoreEtiq")}
    <rect x="${cx}" y="${liseretY}" width="${rectW}" height="${liseretH}" fill="${MAGRIT_POLLEN_MID}"/>
  </g>
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" fill="url(#paperHighlight)" rx="32" ry="32" opacity="0.5" pointer-events="none"/>
  <text x="${flowerCX}" y="${titleY}" text-anchor="middle" font-family="Inter" font-size="48" font-weight="500" font-style="italic" fill="${MAGRIT_INK}" letter-spacing="-0.025em">Magrit</text>
  <text x="${flowerCX}" y="${taglineY}" text-anchor="middle" font-family="Inter" font-size="12" font-weight="400" fill="${MAGRIT_INK}" fill-opacity="0.55" letter-spacing="0.10em">IMPRIMERIE · IA</text>
</svg>`;
}
