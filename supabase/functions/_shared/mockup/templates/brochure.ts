/**
 * Template SVG brochure A4 perspective 3/4 (P17, 2026-06-17) — refonte style Gemini.
 *
 * Composition 3D legere :
 *   - couverture 540x765 centree (x=242, y=130), skewY(-2.5) pour effet 3D
 *   - pile pages internes a gauche : 5 rectangles fins #E8E5DD horizontaux empiles
 *     decales pour simuler la tranche multi-pages reliees
 *   - bandeau haut 35% (268px) tile bleu pastel + marguerite scale 1.6 + Magrit 42 + tagline
 *   - zone centre blanche : bloc visuel 320x200 + 3 lignes mock
 *   - lisere pollen 8px en bas de la couverture
 *   - reference modele bas-droite opacity 0.45
 */
import {
  daisyMagrit,
  escapeXml,
  magritGradientsDefs,
  photoRealisticDefs,
  truncate,
} from "./_shared.ts";

export function brochureSvg(
  specs: { width: number; height: number; productName: string },
  theming: { primaryColor: string },
): string {
  const safeName = escapeXml(truncate(specs.productName, 32));
  const safeColor = theming.primaryColor || "#B7D3F2";
  const coverX = 242;
  const coverY = 130;
  const coverW = 540;
  const coverH = 765;
  const bandeauH = 268;
  const trancheX = coverX - 8;
  const trancheY = coverY + 6;
  const cxCover = coverX + coverW / 2;
  const margCy = coverY + 110;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06" />
        <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.16" />
      </linearGradient>
      ${photoRealisticDefs(safeColor)}
      ${magritGradientsDefs()}
    </defs>
    <rect width="1024" height="1024" fill="url(#bgGrad)" />
    <g transform="skewY(-2.5)">
      <rect x="${trancheX}" y="${trancheY}" width="${coverW + 4}" height="6" fill="#E8E5DD" />
      <rect x="${trancheX - 2}" y="${trancheY + 8}" width="${coverW + 6}" height="6" fill="#E8E5DD" />
      <rect x="${trancheX - 4}" y="${trancheY + 16}" width="${coverW + 8}" height="6" fill="#E8E5DD" />
      <rect x="${trancheX - 2}" y="${trancheY + 24}" width="${coverW + 6}" height="6" fill="#E8E5DD" />
      <rect x="${trancheX}" y="${trancheY + 32}" width="${coverW + 4}" height="6" fill="#E8E5DD" />
      <g filter="url(#shadowDouble)">
        <rect x="${coverX}" y="${coverY}" width="${coverW}" height="${coverH}" fill="#FFFFFF" rx="4" />
        <rect x="${coverX}" y="${coverY}" width="${coverW}" height="${coverH}" fill="url(#paperHighlight)" rx="4" />
        <rect x="${coverX}" y="${coverY}" width="${coverW}" height="${bandeauH}" fill="url(#magritTileGrad)" rx="4" />
        <rect x="${coverX}" y="${coverY + bandeauH - 6}" width="${coverW}" height="6" fill="url(#magritTileGrad)" />
        ${daisyMagrit(cxCover, margCy, 1.6)}
        <text x="${cxCover}" y="${margCy + 115}" text-anchor="middle" font-family="Inter" font-style="italic" font-weight="500" font-size="42" fill="#0F172A" letter-spacing="-0.025em">Magrit</text>
        <text x="${cxCover}" y="${margCy + 140}" text-anchor="middle" font-family="Inter" font-weight="400" font-size="12" fill="#0F172A" letter-spacing="0.08em" opacity="0.55">IMPRIMERIE · IA</text>
        <rect x="${cxCover - 160}" y="${coverY + bandeauH + 60}" width="320" height="200" fill="#F1F5F9" rx="4" />
        <rect x="${coverX + 50}" y="${coverY + bandeauH + 310}" width="440" height="8" fill="#E2E8F0" rx="2" />
        <rect x="${coverX + 50}" y="${coverY + bandeauH + 340}" width="380" height="8" fill="#E2E8F0" rx="2" />
        <rect x="${coverX + 50}" y="${coverY + bandeauH + 370}" width="420" height="8" fill="#E2E8F0" rx="2" />
        <rect x="${coverX}" y="${coverY + coverH - 8}" width="${coverW}" height="8" fill="#F5B529" />
      </g>
    </g>
    <text x="${coverX + coverW}" y="${coverY + coverH + 36}" text-anchor="end" font-family="Inter" font-weight="500" font-size="11" fill="#0F172A" opacity="0.45">${safeName}</text>
  </svg>`;
}
