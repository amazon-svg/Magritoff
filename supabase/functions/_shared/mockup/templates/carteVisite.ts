/**
 * Template SVG paramètrique pour produit type `carteVisite`.
 *
 * Refonte 2026-06-15 (P3-VISUELS) : design Magrit-brandé réaliste qui montre
 * "voici à quoi ressemble une carte de visite imprimée par Magrit". Inspiré
 * des mockups Printoclock/Vistaprint qui affichent un design imprimé visible
 * sur le produit (pas un rectangle blanc avec juste le nom du produit en
 * gros texte).
 *
 * Layout (recto) : carte paysage 85×55 split en 2 zones :
 *   - Bandeau gauche (35%) : tile bleu pastel gradient (couleurs logo Magrit)
 *     avec grande marguerite blanche + cœur pollen jaune.
 *   - Surface droite (65%) : papier blanc, "Magrit" en grand italic, tagline
 *     "imprimerie augmentée par l'IA", 3 lignes de coordonnées simulées, et
 *     productName en petit en bas-droit comme référence du modèle.
 *   - Liseré jaune pollen tout en bas (signature couleur Magrit).
 *
 * Layout (verso) : surface intégrale en tile bleu pastel + grande marguerite
 * centrée + "Magrit" en signature dessous.
 *
 * Cas d usage Clariprint typique : 85x55 mm (BVCard EU standard) ou 90x55 mm.
 * Pas de svgdom, string templating direct.
 *
 * Constantes brand Magrit (cf. src/app/components/brand/MagritLogo.tsx) :
 *   - Tile gradient : #E5F0FC -> #B7D3F2 (135°)
 *   - Cœur pollen radial : #FFE066 -> #F5B529 -> #C68708
 *   - Pétales : #FFFFFF (variant 'plain')
 *   - Ink principal : #0F172A (brand sobre slate-900)
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
const TEXT_MAX_LEN = 32;

// ─── Brand Magrit (constantes design) ──────────────────────────────────────
const MAGRIT_TILE_FROM = "#E5F0FC";
const MAGRIT_TILE_TO = "#B7D3F2";
const MAGRIT_POLLEN_LIGHT = "#FFE066";
const MAGRIT_POLLEN_MID = "#F5B529";
const MAGRIT_POLLEN_DARK = "#C68708";
const MAGRIT_INK = "#0F172A";

/**
 * Génère le SVG inline d une marguerite Magrit (18 pétales blancs + cœur pollen).
 * @param cx centre X dans le viewBox
 * @param cy centre Y dans le viewBox
 * @param scale facteur d échelle (1 = taille du logo d origine)
 * @param coreGradientId id du gradient radial pour le cœur (doit être défini en <defs>)
 */
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

export function carteVisiteSvg(specs: ProductSpecs, theming: ShopTheming): string {
  // BVCard est typiquement paysage. Si l'utilisateur passe portrait, on respecte
  // le ratio mais on inverse les dimensions pour garder la carte horizontale.
  const aspect = Math.max(specs.width, specs.height) / Math.min(specs.width, specs.height);
  const rectW = RECT_AREA_MAX;
  const rectH = RECT_AREA_MAX / aspect;
  const cx = (VIEWBOX - rectW) / 2;
  const cy = (VIEWBOX - rectH) / 2;

  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  const isBack = theming.view === "back";

  // Géométrie split recto : bandeau gauche 35% / surface droite 65%
  const bandW = rectW * 0.35;
  const surfaceX = cx + bandW;
  const surfaceW = rectW - bandW;

  // Marguerite bandeau gauche : centre du bandeau, taille proportionnelle
  const bandFlowerCX = cx + bandW / 2;
  const bandFlowerCY = cy + rectH / 2;
  const bandFlowerScale = Math.min(rectH, bandW) / 90;

  // Surface droite : textes alignés à gauche, padding interne 32px
  const padX = 32;
  const tx = surfaceX + padX;
  const titleY = cy + rectH * 0.42;
  const taglineY = titleY + 30;
  const coord1Y = cy + rectH * 0.66;
  const coord2Y = coord1Y + 22;
  const coord3Y = coord1Y + 44;

  // Liseré pollen en bas
  const liseretY = cy + rectH - 8;
  const liseretH = 8;

  // VERSO : carte tile complète avec grande marguerite centrée + signature
  if (isBack) {
    const backFlowerCX = cx + rectW / 2;
    const backFlowerCY = cy + rectH / 2 - 30;
    const backFlowerScale = Math.min(rectH, rectW) / 110;
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
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" fill="url(#mgTileBack)" rx="16" ry="16" filter="url(#shadowDouble)"/>
  <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" fill="url(#paperHighlight)" rx="16" ry="16" opacity="0.6" pointer-events="none"/>
  ${daisyMagrit(backFlowerCX, backFlowerCY, backFlowerScale, "mgCoreBack")}
  <text x="${backFlowerCX}" y="${cy + rectH * 0.88}" text-anchor="middle" font-family="Inter" font-size="32" font-weight="500" font-style="italic" fill="${MAGRIT_INK}" letter-spacing="-0.02em">Magrit</text>
</svg>`;
  }

  // RECTO : split bandeau gauche tile + surface droite Magrit-brandé
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
    <clipPath id="cardClip">
      <rect x="${cx}" y="${cy}" width="${rectW}" height="${rectH}" rx="16" ry="16"/>
    </clipPath>
    ${photoRealisticDefs(safeColor)}
  </defs>
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>
  ${photoRealisticProductRect(cx, cy, rectW, rectH, 16, safeColor)}
  <g clip-path="url(#cardClip)">
    <rect x="${cx}" y="${cy}" width="${bandW}" height="${rectH}" fill="url(#mgTileBand)"/>
    ${daisyMagrit(bandFlowerCX, bandFlowerCY, bandFlowerScale, "mgCoreBand")}
    <rect x="${cx}" y="${liseretY}" width="${rectW}" height="${liseretH}" fill="${MAGRIT_POLLEN_MID}"/>
  </g>
  <text x="${tx}" y="${titleY}" font-family="Inter" font-size="56" font-weight="500" font-style="italic" fill="${MAGRIT_INK}" letter-spacing="-0.025em">Magrit</text>
  <text x="${tx}" y="${taglineY}" font-family="Inter" font-size="14" font-weight="400" fill="${MAGRIT_INK}" fill-opacity="0.55" letter-spacing="0.06em">imprimerie augmentée par l'IA</text>
  <rect x="${tx}" y="${coord1Y - 12}" width="${surfaceW * 0.62}" height="6" fill="${MAGRIT_INK}" opacity="0.30" rx="2"/>
  <rect x="${tx}" y="${coord2Y - 12}" width="${surfaceW * 0.50}" height="5" fill="${MAGRIT_INK}" opacity="0.22" rx="2"/>
  <rect x="${tx}" y="${coord3Y - 12}" width="${surfaceW * 0.40}" height="5" fill="${MAGRIT_INK}" opacity="0.22" rx="2"/>
</svg>`;
}
