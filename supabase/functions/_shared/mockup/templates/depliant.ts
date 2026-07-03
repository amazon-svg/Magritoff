/**
 * Template SVG depliant 3 volets (P16, 2026-06-16) — refonte visuelle Gemini.
 *
 * Composition 2D depliee a plat :
 *   - 3 volets cote a cote (840x480 centres dans viewBox 1024)
 *   - volet gauche : mock content placeholders gris
 *   - volet central : tile bleu pastel + grosse marguerite + Magrit italic 36
 *   - volet droit : marguerite + Magrit italic 42 + tagline + mock + liseré pollen
 *   - liserés pointillés gris entre volets (matérialisent les plis)
 *   - reference modele en bas-droite opacity 0.45
 */
import {
  daisyMagrit,
  escapeXml,
  magritGradientsDefs,
  photoRealisticDefs,
  truncate,
} from "./_shared.ts";

export function depliantSvg(
  specs: { width: number; height: number; productName: string },
  theming: { primaryColor: string },
): string {
  const safeName = escapeXml(truncate(specs.productName, 35));
  const safeColor = theming.primaryColor || "#B7D3F2";
  const totalW = 840;
  const voletW = totalW / 3;
  const h = 480;
  const x = (1024 - totalW) / 2;
  const y = (1024 - h) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
    <defs><linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${safeColor}" stop-opacity="0.08" /><stop offset="100%" stop-color="${safeColor}" stop-opacity="0.16" /></linearGradient>${photoRealisticDefs(safeColor)}${magritGradientsDefs()}</defs>
    <rect width="1024" height="1024" fill="url(#bgGrad)" /><g filter="url(#shadowDouble)"><rect x="${x}" y="${y}" width="${totalW}" height="${h}" fill="#FFFFFF" rx="4" /><rect x="${x}" y="${y}" width="${totalW}" height="${h}" fill="url(#paperHighlight)" rx="4" />
      <g transform="translate(${x} ${y})"><rect x="30" y="40" width="120" height="80" fill="#F1F5F9" rx="2" /><rect x="30" y="140" width="220" height="8" fill="#E2E8F0" rx="1" /><rect x="30" y="160" width="180" height="8" fill="#E2E8F0" rx="1" /><rect x="30" y="220" width="220" height="100" fill="#F1F5F9" rx="2" /><rect x="30" y="340" width="200" height="8" fill="#E2E8F0" rx="1" /></g>
      <g transform="translate(${x + voletW} ${y})"><rect x="0" y="0" width="${voletW}" height="${h}" fill="url(#magritTileGrad)" />${daisyMagrit(voletW / 2, h / 2 - 30, 1.4)}<text x="${voletW / 2}" y="${h / 2 + 50}" text-anchor="middle" font-family="Inter" font-style="italic" font-weight="500" font-size="36" fill="#0F172A" letter-spacing="-0.025em">Magrit</text></g>
      <g transform="translate(${x + voletW * 2} ${y})">${daisyMagrit(voletW / 2, 100, 1.1)}<text x="${voletW / 2}" y="200" text-anchor="middle" font-family="Inter" font-style="italic" font-weight="500" font-size="42" fill="#0F172A" letter-spacing="-0.025em">Magrit</text><text x="${voletW / 2}" y="225" text-anchor="middle" font-family="Inter" font-weight="400" font-size="11" fill="#0F172A" letter-spacing="0.08em" opacity="0.55">IMPRIMERIE · IA</text><rect x="40" y="300" width="200" height="8" fill="#E2E8F0" rx="1" /><rect x="40" y="320" width="140" height="8" fill="#E2E8F0" rx="1" /><rect x="0" y="${h - 8}" width="${voletW}" height="8" fill="#F5B529" /></g>
      <line x1="${x + voletW}" y1="${y}" x2="${x + voletW}" y2="${y + h}" stroke="#CBD5E1" stroke-dasharray="4 4" stroke-width="1.5" /><line x1="${x + voletW * 2}" y1="${y}" x2="${x + voletW * 2}" y2="${y + h}" stroke="#CBD5E1" stroke-dasharray="4 4" stroke-width="1.5" /></g>
    <text x="${x + totalW}" y="${y + h + 30}" text-anchor="end" font-family="Inter" font-weight="500" font-size="11" fill="#0F172A" opacity="0.45">${safeName}</text>
  </svg>`;
}
