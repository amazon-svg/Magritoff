/**
 * Template SVG flyer A5 148x210 (P17, 2026-06-17) — refonte alignee style Gemini.
 *
 * Composition 2D portrait :
 *   - bloc flyer 600x850 centre viewBox 1024 (x=212, y=87), shadowDouble
 *   - 3 zones verticales :
 *     * zone haute 30% (255px) tile bleu pastel : marguerite scale 1.4 + Magrit 64 + tagline
 *     * zone centre 50% (425px) surface blanche : bloc visuel 200x120 + 4 lignes mock
 *     * zone basse 20% (170px) surface blanche : 2 lignes mock + lisere pollen 8px
 *   - reference modele bas-droite opacity 0.45
 */
import {
  daisyMagrit,
  escapeXml,
  magritGradientsDefs,
  photoRealisticDefs,
  truncate,
} from "./_shared.ts";

export function flyerSvg(
  specs: { width: number; height: number; productName: string },
  theming: { primaryColor: string },
): string {
  const safeName = escapeXml(truncate(specs.productName, 32));
  const safeColor = theming.primaryColor || "#B7D3F2";
  const blocX = 212;
  const blocY = 87;
  const blocW = 600;
  const blocH = 850;
  const zoneHauteH = 255;
  const zoneCentreY = blocY + zoneHauteH;
  const zoneCentreH = 425;
  const zoneBasseY = zoneCentreY + zoneCentreH;
  const cxBloc = blocX + blocW / 2;
  const margCy = blocY + 110;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06" />
        <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.15" />
      </linearGradient>
      ${photoRealisticDefs(safeColor)}
      ${magritGradientsDefs()}
    </defs>
    <rect width="1024" height="1024" fill="url(#bgGrad)" />
    <g filter="url(#shadowDouble)">
      <rect x="${blocX}" y="${blocY}" width="${blocW}" height="${blocH}" fill="#FFFFFF" rx="6" />
      <rect x="${blocX}" y="${blocY}" width="${blocW}" height="${blocH}" fill="url(#paperHighlight)" rx="6" />
      <rect x="${blocX}" y="${blocY}" width="${blocW}" height="${zoneHauteH}" fill="url(#magritTileGrad)" rx="6" />
      <rect x="${blocX}" y="${blocY + zoneHauteH - 6}" width="${blocW}" height="6" fill="url(#magritTileGrad)" />
      ${daisyMagrit(cxBloc, margCy, 1.4)}
      <text x="${cxBloc}" y="${margCy + 95}" text-anchor="middle" font-family="Inter" font-style="italic" font-weight="500" font-size="64" fill="#0F172A" letter-spacing="-0.025em">Magrit</text>
      <text x="${cxBloc}" y="${margCy + 125}" text-anchor="middle" font-family="Inter" font-weight="400" font-size="12" fill="#0F172A" letter-spacing="0.08em" opacity="0.55">IMPRIMERIE · IA</text>
      <rect x="${cxBloc - 100}" y="${zoneCentreY + 50}" width="200" height="120" fill="#F1F5F9" rx="4" />
      <rect x="${blocX + 60}" y="${zoneCentreY + 220}" width="480" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 60}" y="${zoneCentreY + 250}" width="420" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 60}" y="${zoneCentreY + 280}" width="450" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 60}" y="${zoneCentreY + 310}" width="380" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 60}" y="${zoneBasseY + 40}" width="400" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 60}" y="${zoneBasseY + 70}" width="320" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX}" y="${blocY + blocH - 8}" width="${blocW}" height="8" fill="#F5B529" />
    </g>
    <text x="${blocX + blocW}" y="${blocY + blocH + 32}" text-anchor="end" font-family="Inter" font-weight="500" font-size="11" fill="#0F172A" opacity="0.45">${safeName}</text>
  </svg>`;
}
