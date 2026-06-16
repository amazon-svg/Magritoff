/**
 * Template SVG paramètrique pour produit type `packaging` (P15, 2026-06-16).
 *
 * Layout : boîte kraft 3D vue 3/4 ouverte légèrement avec rabats relevés.
 * Inspiré de la référence PrintCanick screenshot Arnaud (boîte d'expédition
 * marron avec motif imprimé dessus).
 *
 * Composition :
 *   - Face avant trapézoïdale (perspective avec faux 3D)
 *   - Côté droit (parallélogramme penché)
 *   - Rabats supérieurs ouverts (2 polygones)
 *   - Marquage Magrit sur la face avant (marguerite + lockup)
 *   - Couleur kraft #C8A87D avec variations (highlights / shadows)
 */

import type { ProductSpecs, ShopTheming } from "../types.ts";
import { escapeXml, photoRealisticDefs, truncate } from "./_shared.ts";

const VIEWBOX = 1024;
const TEXT_MAX_LEN = 32;

const KRAFT_LIGHT = "#D4B791";
const KRAFT_BASE = "#C8A87D";
const KRAFT_MID = "#A87F4E";
const KRAFT_DARK = "#7A5A35";
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

export function packagingSvg(specs: ProductSpecs, theming: ShopTheming): string {
  const safeName = escapeXml(truncate(specs.productName, TEXT_MAX_LEN));
  const safeColor = escapeXml(theming.primaryColor);

  // Géométrie boîte 3D : la face avant prend la majorité du viewBox (paysage),
  // côté droit + rabats forment l'illusion 3D.
  // Coordonnées (en absolu dans le viewBox 1024x1024) :
  //   - Face avant : trapèze légèrement perspective (corner gauche bas plus
  //     bas que corner droit bas pour effet 3D)
  //   - Côté droit : parallelogramme penché vers la droite
  //   - Rabats supérieurs : 2 polygones ouverts
  const faceFromX = 180;
  const faceToX = 720;
  const faceTopY = 380;
  const faceBottomY = 780;
  // Côté droit fuyant vers le coin haut-droite
  const sideRightX = 880;
  const sideTopRightY = 320;
  const sideBottomRightY = 720;
  // Rabats supérieurs (2 trapezes ouverts) — derrière + devant
  const flapBackTopY = 200;
  const flapFrontTipY = 250;

  // Marquage Magrit centré sur la face avant
  const flowerCX = (faceFromX + faceToX) / 2;
  const flowerCY = faceTopY + (faceBottomY - faceTopY) * 0.36; // plus haut pour laisser place au texte
  const flowerScale = 1.4; // legerement plus petit pour eviter overlap

  // Texte Magrit + ref produit BIEN sous la marguerite (pas de superposition)
  const titleY = flowerCY + 95;
  const refY = titleY + 26;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.14"/>
    </linearGradient>
    <linearGradient id="kraftFace" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${KRAFT_LIGHT}"/>
      <stop offset="100%" stop-color="${KRAFT_BASE}"/>
    </linearGradient>
    <linearGradient id="kraftSide" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${KRAFT_BASE}"/>
      <stop offset="100%" stop-color="${KRAFT_DARK}"/>
    </linearGradient>
    <linearGradient id="kraftFlapBack" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${KRAFT_DARK}"/>
      <stop offset="100%" stop-color="${KRAFT_MID}"/>
    </linearGradient>
    <linearGradient id="kraftFlapFront" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="${KRAFT_BASE}"/>
      <stop offset="100%" stop-color="${KRAFT_LIGHT}"/>
    </linearGradient>
    <radialGradient id="mgCorePackaging" cx="45%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${MAGRIT_POLLEN_LIGHT}"/>
      <stop offset="70%" stop-color="${MAGRIT_POLLEN_MID}"/>
      <stop offset="100%" stop-color="${MAGRIT_POLLEN_DARK}"/>
    </radialGradient>
    <filter id="boxShadow" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#000" flood-opacity="0.18"/>
    </filter>
    ${photoRealisticDefs(safeColor)}
  </defs>

  <!-- Fond -->
  <rect width="${VIEWBOX}" height="${VIEWBOX}" fill="url(#bg)"/>

  <!-- Rabat arrière (visible derrière, plus sombre) -->
  <polygon
    points="${faceFromX + 20},${faceTopY} ${sideRightX - 20},${sideTopRightY} ${sideRightX},${flapBackTopY + 60} ${faceFromX + 40},${flapBackTopY + 30}"
    fill="url(#kraftFlapBack)"
    stroke="${KRAFT_DARK}"
    stroke-width="1.5"
    opacity="0.92"
    filter="url(#boxShadow)"
  />

  <!-- Côté droit (parallélogramme penché) -->
  <polygon
    points="${faceToX},${faceTopY} ${sideRightX},${sideTopRightY} ${sideRightX},${sideBottomRightY} ${faceToX},${faceBottomY}"
    fill="url(#kraftSide)"
    stroke="${KRAFT_DARK}"
    stroke-width="1.5"
  />

  <!-- Face avant principale (trapèze légèrement perspective) -->
  <polygon
    points="${faceFromX},${faceTopY} ${faceToX},${faceTopY} ${faceToX},${faceBottomY} ${faceFromX},${faceBottomY}"
    fill="url(#kraftFace)"
    stroke="${KRAFT_DARK}"
    stroke-width="1.5"
    filter="url(#boxShadow)"
  />

  <!-- Lignes de pliage (sillons) face avant -->
  <line x1="${faceFromX}" y1="${faceTopY}" x2="${faceToX}" y2="${faceTopY}" stroke="${KRAFT_DARK}" stroke-width="1" opacity="0.35"/>
  <line x1="${faceToX}" y1="${faceTopY}" x2="${faceToX}" y2="${faceBottomY}" stroke="${KRAFT_DARK}" stroke-width="1" opacity="0.35"/>

  <!-- Rabat avant (visible devant la face, légèrement releve) -->
  <polygon
    points="${faceFromX},${faceTopY} ${faceToX},${faceTopY} ${faceToX - 60},${flapFrontTipY} ${faceFromX + 40},${flapFrontTipY + 20}"
    fill="url(#kraftFlapFront)"
    stroke="${KRAFT_DARK}"
    stroke-width="1.5"
  />

  <!-- Marquage Magrit sur la face avant : marguerite blanche centrée -->
  ${daisyMagrit(flowerCX, flowerCY, flowerScale, "mgCorePackaging")}

  <!-- "Magrit" en lockup italic sous la marguerite -->
  <text
    x="${flowerCX}"
    y="${titleY}"
    text-anchor="middle"
    font-family="Inter"
    font-size="42"
    font-weight="500"
    font-style="italic"
    fill="#FFFFFF"
    letter-spacing="-0.025em"
    opacity="0.95"
  >Magrit</text>

  <!-- Référence produit en petit -->
  <text
    x="${flowerCX}"
    y="${refY}"
    text-anchor="middle"
    font-family="Inter"
    font-size="13"
    font-weight="500"
    fill="#FFFFFF"
    opacity="0.75"
    letter-spacing="0.08em"
  >${safeName}</text>

  <!-- Liseré pollen jaune en bas de la face (signature couleur Magrit) -->
  <rect
    x="${faceFromX}"
    y="${faceBottomY - 12}"
    width="${faceToX - faceFromX}"
    height="6"
    fill="${MAGRIT_POLLEN_MID}"
    opacity="0.85"
  />
</svg>`;
}
