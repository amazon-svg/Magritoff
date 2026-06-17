/**
 * Template SVG packaging boite kraft 3D (P17, 2026-06-17) — refonte style Gemini.
 *
 * Composition 3D perspective 3/4 :
 *   - face avant polygon (x=275 a 725, y=350 a 750)
 *   - face dessus polygon perspective 3/4
 *   - face laterale droite polygon perspective
 *   - gradient kraft 4 stops #C8A87D -> #D4B791 -> #A87F4E -> #7A5A35
 *   - 2 rabats releves vers l arriere (trapezoidaux)
 *   - medaillon circulaire r=70 bleu pastel sur face avant avec marguerite scale 1.0
 *   - Magrit italic 32 sous medaillon + tagline
 *   - lisere pollen 8px en bas face avant
 *   - reference modele bas-droite opacity 0.45
 */
import {
  daisyMagrit,
  escapeXml,
  magritGradientsDefs,
  photoRealisticDefs,
  truncate,
} from "./_shared.ts";

export function packagingSvg(
  specs: { width: number; height: number; productName: string },
  theming: { primaryColor: string },
): string {
  const safeName = escapeXml(truncate(specs.productName, 32));
  const safeColor = theming.primaryColor || "#B7D3F2";
  const faX1 = 275;
  const faX2 = 725;
  const faY1 = 350;
  const faY2 = 750;
  const dessusX1 = faX1 + 65;
  const dessusY1 = faY1 - 60;
  const dessusX2 = faX2 + 65;
  const latBd = faY2 - 60;
  const cxFa = (faX1 + faX2) / 2;
  const cyFa = (faY1 + faY2) / 2;
  const medaillonR = 70;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.05" />
        <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.14" />
      </linearGradient>
      <linearGradient id="kraftFace" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#D4B791" />
        <stop offset="35%" stop-color="#C8A87D" />
        <stop offset="75%" stop-color="#A87F4E" />
        <stop offset="100%" stop-color="#7A5A35" />
      </linearGradient>
      <linearGradient id="kraftTop" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#E0C7A5" />
        <stop offset="100%" stop-color="#C8A87D" />
      </linearGradient>
      <linearGradient id="kraftSide" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#A87F4E" />
        <stop offset="100%" stop-color="#6B4F2E" />
      </linearGradient>
      <linearGradient id="rabatGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#B89766" />
        <stop offset="100%" stop-color="#8F6B40" />
      </linearGradient>
      ${photoRealisticDefs(safeColor)}
      ${magritGradientsDefs()}
    </defs>
    <rect width="1024" height="1024" fill="url(#bgGrad)" />
    <polygon points="${faX1 - 30},${faY1 - 80} ${faX1 + 40},${faY1 - 140} ${dessusX1 - 20},${dessusY1 - 30} ${dessusX1 - 90},${dessusY1 + 30}" fill="url(#rabatGrad)" opacity="0.85" />
    <polygon points="${faX2 - 40},${faY1 - 140} ${faX2 + 30},${faY1 - 80} ${dessusX2 + 80},${dessusY1 + 20} ${dessusX2 + 10},${dessusY1 - 40}" fill="url(#rabatGrad)" opacity="0.85" />
    <g filter="url(#shadowDouble)">
      <polygon points="${dessusX1},${dessusY1} ${dessusX2},${dessusY1} ${faX2},${faY1} ${faX1},${faY1}" fill="url(#kraftTop)" />
      <polygon points="${faX2},${faY1} ${dessusX2},${dessusY1} ${dessusX2},${latBd} ${faX2},${faY2}" fill="url(#kraftSide)" />
      <polygon points="${faX1},${faY1} ${faX2},${faY1} ${faX2},${faY2} ${faX1},${faY2}" fill="url(#kraftFace)" />
      <polygon points="${faX1},${faY1} ${faX2},${faY1} ${faX2},${faY2} ${faX1},${faY2}" fill="url(#paperHighlight)" opacity="0.4" />
      <circle cx="${cxFa}" cy="${cyFa - 25}" r="${medaillonR}" fill="url(#magritTileGrad)" />
      <circle cx="${cxFa}" cy="${cyFa - 25}" r="${medaillonR}" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.6" />
      ${daisyMagrit(cxFa, cyFa - 25, 1.0)}
      <text x="${cxFa}" y="${cyFa + 80}" text-anchor="middle" font-family="Inter" font-style="italic" font-weight="500" font-size="32" fill="#0F172A" letter-spacing="-0.025em">Magrit</text>
      <text x="${cxFa}" y="${cyFa + 105}" text-anchor="middle" font-family="Inter" font-weight="400" font-size="10" fill="#0F172A" letter-spacing="0.08em" opacity="0.6">IMPRIMERIE · IA</text>
      <rect x="${faX1}" y="${faY2 - 8}" width="${faX2 - faX1}" height="8" fill="#F5B529" />
    </g>
    <text x="${dessusX2 + 80}" y="${faY2 + 40}" text-anchor="end" font-family="Inter" font-weight="500" font-size="11" fill="#0F172A" opacity="0.45">${safeName}</text>
  </svg>`;
}
