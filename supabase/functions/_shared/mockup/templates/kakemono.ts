/**
 * Template SVG paramètrique pour produit type `kakemono`.
 *
 * Refonte 2026-06-15 (P3-VISUELS) : design Magrit-brandé vertical.
 * Layout (très portrait, ratio ~1:2.35) :
 *   - Bande supérieure (~28% rectH) : tile bleu pastel pleine largeur + grande
 *     marguerite Magrit centrée
 *   - Zone milieu (~50% rectH) : surface papier, "Magrit" italic énorme,
 *     tagline, 2-3 lignes de texte mock (accroche événement)
 *   - Zone bas (~22% rectH) : 3 lignes contact + URL + liseré pollen
 *   - Pied gris foncé (roll-up support) conservé sous la zone visible
 *
 * Cas d usage Clariprint typique : 850x2000 mm vertical (roll-up standard).
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import {
  escapeXml,
  photoRealisticDefs,
  photoRealisticProductRect,
  truncate,
} from "./_shared.ts";

const VIEWBOX = 1024;
const SHAPE_HEIGHT_MAX = 880;
const FOOT_HEIGHT = 28;
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

export function kakemonoSvg(specs: ProductSpecs, theming: ShopTheming): string {
  const aspect = Math.min(specs.width, specs.height) / Math.max(specs.width, specs.height);
  const rectH = SHAPE_HEIGHT_MAX;
  const rectW = rectH * aspect;
  const cx = (VIEWBOX - rectW) / 2;
  const cy = (VIEWBOX - rectH) / 2;

  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  // Zone 1 : bandeau tile + marguerite (haut)
  const zone1H = rectH * 0.28;
  const flowerCX = cx + rectW / 2;
  const flowerCY = cy + zone1H / 2;
  const flowerScale = Math.min(rectW, zone1H) / 110;

  // Zone 2 : textes (milieu)
  const titleY = cy + zone1H + 80;
  const taglineY = titleY + 28;
  const corps1Y = titleY + 100;
  const corps2Y = corps1Y + 30;
  const corps3Y = corps1Y + 60;

  // Zone 3 : contact + références (bas)
  const contactY = cy + rectH - 90;
  const refY = cy + rectH - 60;
  const liseretY = cy + rectH - 8;
  const liseretH = 8;

  // Pied du roll-up
  const footW = rectW * 1.3;
  const footX = (VIEWBOX - footW) / 2;
  const footY = cy + rectH - FOOT_HEIGHT / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.16"/>
    </linearGradient>
    <linearGradient id="mgTileKakemono" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${MAGRIT_TILE_FROM}"/>
      <stop offset="100%" stop-color="${MAGRIT_TILE_TO}"/>
    </linearGradient>
    <radialGradient id="mgCoreKakemono" cx="45%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${MAGRIT_POLLEN_LIGHT}"/>
      <stop offset="70%" stop-color="${MAGRIT_POLLEN_MID}"/>
      <stop offset="100%" stop-color="${MAGRIT_POLLEN_DARK}"/>
    </radialGradient>
    <clipPath id="kakemonoClip">
      <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" rx="4" ry="4"/>
    </clipPath>
    ${photoRealisticDefs(safeColor)}
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  ${photoRealisticProductRect(cx, cy, rectW, rectH, 4, safeColor)}
  <g clip-path="url(#kakemonoClip)">
    <rect x="${cx}" y="${cy}" width="${rectW}" height="${zone1H}" fill="url(#mgTileKakemono)"/>
    ${daisyMagrit(flowerCX, flowerCY, flowerScale, "mgCoreKakemono")}
    <rect x="${cx}" y="${liseretY}" width="${rectW}" height="${liseretH}" fill="${MAGRIT_POLLEN_MID}"/>
  </g>
  <text x="${flowerCX}" y="${titleY}" text-anchor="middle" font-family="Inter" font-size="56" font-weight="700" fill="${MAGRIT_INK}" letter-spacing="-0.025em">${safeName}</text>
  <text x="${flowerCX}" y="${taglineY}" text-anchor="middle" font-family="Inter" font-size="16" font-weight="500" font-style="italic" fill="${MAGRIT_INK}" fill-opacity="0.60" letter-spacing="-0.01em">by Magrit · imprimerie augmentée par l'IA</text>
  <rect x="${cx + 60}" y="${corps1Y - 14}" width="${rectW - 120}" height="6" fill="${MAGRIT_INK}" opacity="0.32" rx="2"/>
  <rect x="${cx + 60}" y="${corps2Y - 14}" width="${(rectW - 120) * 0.82}" height="5" fill="${MAGRIT_INK}" opacity="0.22" rx="2"/>
  <rect x="${cx + 60}" y="${corps3Y - 14}" width="${(rectW - 120) * 0.72}" height="5" fill="${MAGRIT_INK}" opacity="0.22" rx="2"/>
  <text x="${flowerCX}" y="${contactY}" text-anchor="middle" font-family="Inter" font-size="14" font-weight="500" fill="${MAGRIT_INK}" fill-opacity="0.65" letter-spacing="0.06em">magrit.io · contact@magrit.io</text>
  <rect x="${footX}" y="${footY}" width="${footW}" height="${FOOT_HEIGHT}" fill="#2A2A2D" rx="6"/>
</svg>`;
}
