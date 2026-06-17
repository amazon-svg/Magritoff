/**
 * Template SVG kakemono / roll-up 850x2000 (P17, 2026-06-17) — refonte style Gemini.
 *
 * Composition 2D vertical etire :
 *   - bloc kakemono 380x900 centre viewBox 1024 (x=322, y=62)
 *   - 4 zones empilees :
 *     * bandeau haut 25% (225px) tile bleu pastel : marguerite scale 1.6 + Magrit 60 + tagline
 *     * corps 55% (495px) surface blanche : 5 lignes mock + 2 blocs gris
 *     * lisere pollen 8px frontiere corps/socle
 *     * socle metallique 18% (172px) gris fonce #475569 + reflet cylindrique
 *   - reference modele bas-droite opacity 0.45
 */
import {
  daisyMagrit,
  escapeXml,
  magritGradientsDefs,
  photoRealisticDefs,
  truncate,
} from "./_shared.ts";

export function kakemonoSvg(
  specs: { width: number; height: number; productName: string },
  theming: { primaryColor: string },
): string {
  const safeName = escapeXml(truncate(specs.productName, 32));
  const safeColor = theming.primaryColor || "#B7D3F2";
  const blocX = 322;
  const blocY = 62;
  const blocW = 380;
  const bandeauH = 225;
  const corpsY = blocY + bandeauH;
  const corpsH = 495;
  const polleY = corpsY + corpsH;
  const socleY = polleY + 8;
  const socleH = 172;
  const cxBloc = blocX + blocW / 2;
  const margCy = blocY + 95;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.06" />
        <stop offset="100%" stop-color="${safeColor}" stop-opacity="0.15" />
      </linearGradient>
      <linearGradient id="socleReflet" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18" />
        <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.04" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
      </linearGradient>
      ${photoRealisticDefs(safeColor)}
      ${magritGradientsDefs()}
    </defs>
    <rect width="1024" height="1024" fill="url(#bgGrad)" />
    <g filter="url(#shadowDouble)">
      <rect x="${blocX}" y="${blocY}" width="${blocW}" height="${corpsH + bandeauH}" fill="#FFFFFF" rx="4" />
      <rect x="${blocX}" y="${blocY}" width="${blocW}" height="${corpsH + bandeauH}" fill="url(#paperHighlight)" rx="4" />
      <rect x="${blocX}" y="${blocY}" width="${blocW}" height="${bandeauH}" fill="url(#magritTileGrad)" rx="4" />
      <rect x="${blocX}" y="${blocY + bandeauH - 6}" width="${blocW}" height="6" fill="url(#magritTileGrad)" />
      ${daisyMagrit(cxBloc, margCy, 1.6)}
      <text x="${cxBloc}" y="${margCy + 92}" text-anchor="middle" font-family="Inter" font-style="italic" font-weight="500" font-size="60" fill="#0F172A" letter-spacing="-0.025em">Magrit</text>
      <text x="${cxBloc}" y="${margCy + 120}" text-anchor="middle" font-family="Inter" font-weight="400" font-size="12" fill="#0F172A" letter-spacing="0.08em" opacity="0.55">IMPRIMERIE · IA</text>
      <rect x="${blocX + 40}" y="${corpsY + 55}" width="300" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 40}" y="${corpsY + 85}" width="260" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 40}" y="${corpsY + 115}" width="280" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 40}" y="${corpsY + 145}" width="240" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 40}" y="${corpsY + 175}" width="290" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 40}" y="${corpsY + 220}" width="140" height="120" fill="#F1F5F9" rx="4" />
      <rect x="${blocX + 200}" y="${corpsY + 220}" width="140" height="120" fill="#F1F5F9" rx="4" />
      <rect x="${blocX + 40}" y="${corpsY + 380}" width="280" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX + 40}" y="${corpsY + 410}" width="220" height="8" fill="#E2E8F0" rx="2" />
      <rect x="${blocX}" y="${polleY}" width="${blocW}" height="8" fill="#F5B529" />
    </g>
    <rect x="${blocX - 20}" y="${socleY}" width="${blocW + 40}" height="${socleH}" fill="#475569" rx="6" />
    <rect x="${blocX - 20}" y="${socleY}" width="${blocW + 40}" height="${socleH}" fill="url(#socleReflet)" rx="6" />
    <text x="${blocX + blocW + 20}" y="${socleY + socleH + 28}" text-anchor="end" font-family="Inter" font-weight="500" font-size="11" fill="#0F172A" opacity="0.45">${safeName}</text>
  </svg>`;
}
