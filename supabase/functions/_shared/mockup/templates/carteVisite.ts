/**
 * Template SVG carteVisite 85x55 (P17, 2026-06-17) — refonte alignee style Gemini.
 *
 * Composition 2D paysage :
 *   - bloc carte 800x515 centre viewBox 1024 (x=112, y=255), shadowDouble
 *   - split vertical 35/65 :
 *     * zone gauche tile bleu pastel 280x515 : marguerite scale 1.0 + Magrit 36 + tagline
 *     * zone droite surface blanche 520x515 : carre logo client 80x80 + 4 lignes mock
 *   - lisere pollen 8px en bas du bloc carte
 *   - reference modele bas-droite opacity 0.45
 */
import {
  daisyMagrit,
  escapeXml,
  magritGradientsDefs,
  photoRealisticDefs,
  truncate,
} from "./_shared.ts";

export function carteVisiteSvg(
  specs: { width: number; height: number; productName: string },
  theming: { primaryColor: string },
): string {
  const safeName = escapeXml(truncate(specs.productName, 32));
  const safeColor = theming.primaryColor || "#B7D3F2";
  const blocX = 112;
  const blocY = 255;
  const blocW = 800;
  const blocH = 515;
  const tileW = 280;
  const surfaceX = blocX + tileW;
  const tileCx = blocX + tileW / 2;
  const tileCy = blocY + 220;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.05" />
        <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.14" />
      </linearGradient>
      ${photoRealisticDefs(safeColor)}
      ${magritGradientsDefs()}
    </defs>
    <rect width="1024" height="1024" fill="url(#bgGrad)" />
    <g filter="url(#shadowDouble)">
      <rect x="${blocX}" y="${blocY}" width="${blocW}" height="${blocH}" fill="#FFFFFF" rx="6" />
      <rect x="${blocX}" y="${blocY}" width="${blocW}" height="${blocH}" fill="url(#paperHighlight)" rx="6" />
      <rect x="${blocX}" y="${blocY}" width="${tileW}" height="${blocH}" fill="url(#magritTileGrad)" rx="6" />
      <rect x="${blocX + tileW - 6}" y="${blocY}" width="6" height="${blocH}" fill="url(#magritTileGrad)" />
      ${daisyMagrit(tileCx, tileCy, 1.0)}
      <text x="${tileCx}" y="${tileCy + 90}" text-anchor="middle" font-family="Inter" font-style="italic" font-weight="500" font-size="36" fill="#0F172A" letter-spacing="-0.025em">Magrit</text>
      <text x="${tileCx}" y="${tileCy + 115}" text-anchor="middle" font-family="Inter" font-weight="400" font-size="11" fill="#0F172A" letter-spacing="0.08em" opacity="0.6">IMPRIMERIE · IA</text>
      <rect x="${surfaceX + 30}" y="${blocY + 40}" width="80" height="80" fill="#F1F5F9" rx="4" />
      <rect x="${surfaceX + 30}" y="${blocY + 170}" width="440" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${surfaceX + 30}" y="${blocY + 200}" width="380" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${surfaceX + 30}" y="${blocY + 250}" width="400" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${surfaceX + 30}" y="${blocY + 280}" width="340" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX}" y="${blocY + blocH - 8}" width="${blocW}" height="8" fill="#F5B529" />
    </g>
    <text x="${blocX + blocW}" y="${blocY + blocH + 32}" text-anchor="end" font-family="Inter" font-weight="500" font-size="11" fill="#0F172A" opacity="0.45">${safeName}</text>
  </svg>`;
}
