/**
 * Template SVG paramètrique pour produit type `brochure`.
 *
 * Refonte P15 (2026-06-16) : visuel 3D plus réaliste demandé par Arnaud :
 *   - Moins zoomé que la version précédente (qui dégueulait du cadre)
 *   - On distingue clairement une brochure (livre fermé/couverture)
 *   - Perspective 3/4 légère pour suggérer le volume / les pages
 *   - Marquage Magrit visible sur la couverture
 *
 * Composition :
 *   - Couverture principale (rectangle portrait) légèrement penchée
 *   - Ombre portée prononcée pour effet épaisseur
 *   - Tranche latérale (rectangle fin penché côté gauche) suggérant les
 *     pages internes empilées
 *   - Marguerite Magrit centrée en couverture (taille réduite vs ancienne
 *     version pour laisser respirer le visuel)
 *   - "Magrit" italic + tagline + référence
 *   - Liseré pollen en bas
 *
 * Cas d usage Clariprint typique : A4 ou A5 brochée multi-pages.
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
const PAGE_EDGE = "#E8E5DD";

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
  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  // Géométrie brochure 3D :
  //   - Couverture portrait centrée dans le viewBox, taille réduite (500×680)
  //     pour laisser de la respiration autour (avant : 760×panelW × 2 trop gros).
  //   - Légère rotation Y simulée par : déformation trapèze (corner gauche
  //     un peu plus haut et plus loin que corner droit, créant illusion 3D).
  //   - Tranche latérale (côté gauche) pour suggérer pages internes.
  const coverW = 380;
  const coverH = 540;
  const cx = (VIEWBOX - coverW) / 2 + 20; // décalé légèrement à droite (cohérence visuelle)
  const cy = (VIEWBOX - coverH) / 2;

  // Coordonnées trapèze perspective (corner gauche plus haut/loin que droit)
  const tlx = cx - 18;
  const tly = cy + 8;
  const trx = cx + coverW;
  const trY = cy;
  const blx = cx - 18;
  const blY = cy + coverH + 8;
  const brx = cx + coverW;
  const brY = cy + coverH;

  // Tranche latérale (5 pages empilées sur le côté gauche)
  const sliceCount = 4;
  const sliceX = tlx - 14;
  const sliceY1 = tly + 6;
  const sliceY2 = blY - 6;

  // Marquage Magrit centré sur couverture
  const flowerCX = cx + coverW / 2 - 5;
  const flowerCY = cy + coverH * 0.32;
  const flowerScale = 1.3;

  const titleY = flowerCY + 60;
  const taglineY = titleY + 24;
  const refY = cy + coverH - 28;
  const liseretY = cy + coverH - 10;
  const liseretH = 6;

  // Pre-render des slices (pages internes en perspective)
  let sliceMarkup = "";
  for (let i = 0; i < sliceCount; i++) {
    const offset = i * 3;
    sliceMarkup += `<polygon points="${sliceX - offset},${sliceY1 + offset / 2} ${tlx - offset},${tly + offset / 2 + 2} ${tlx - offset},${blY - offset / 2 - 2} ${sliceX - offset},${sliceY2 - offset / 2}" fill="${PAGE_EDGE}" stroke="${safeColor}" stroke-width="0.5" opacity="${0.95 - i * 0.1}"/>`;
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
    <filter id="brochureShadow" x="-15%" y="-15%" width="135%" height="135%">
      <feDropShadow dx="6" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.18"/>
    </filter>
    ${photoRealisticDefs(safeColor)}
  </defs>

  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>

  <!-- Tranche latérale (pages internes empilées) -->
  ${sliceMarkup}

  <!-- Couverture (trapèze perspective 3/4) -->
  <polygon
    points="${tlx},${tly} ${trx},${trY} ${brx},${brY} ${blx},${blY}"
    fill="url(#mgTileCover)"
    stroke="${safeColor}"
    stroke-width="1.5"
    filter="url(#brochureShadow)"
  />
  <polygon
    points="${tlx},${tly} ${trx},${trY} ${brx},${brY} ${blx},${blY}"
    fill="url(#paperHighlight)"
    opacity="0.45"
    pointer-events="none"
  />

  <!-- Marguerite Magrit centrée couverture -->
  ${daisyMagrit(flowerCX, flowerCY, flowerScale, "mgCoreCover")}

  <!-- "Magrit" italic + tagline + référence sur couverture -->
  <text x="${flowerCX}" y="${titleY}" text-anchor="middle" font-family="Inter" font-size="40" font-weight="500" font-style="italic" fill="${MAGRIT_INK}" letter-spacing="-0.025em">Magrit</text>
  <text x="${flowerCX}" y="${taglineY}" text-anchor="middle" font-family="Inter" font-size="11" font-weight="400" fill="${MAGRIT_INK}" fill-opacity="0.60" letter-spacing="0.08em">IMPRIMERIE · IA</text>
  <text x="${flowerCX}" y="${refY}" text-anchor="middle" font-family="Inter" font-size="11" font-weight="500" fill="${MAGRIT_INK}" fill-opacity="0.50" letter-spacing="0.04em">${safeName}</text>

  <!-- Liseré pollen jaune en bas de couverture -->
  <rect x="${tlx + 8}" y="${liseretY}" width="${coverW - 16}" height="${liseretH}" fill="${MAGRIT_POLLEN_MID}" opacity="0.85"/>
</svg>`;
}

