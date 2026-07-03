/**
 * Template SVG etiquette ronde (P16, 2026-06-16) — refonte visuelle Gemini.
 *
 * Composition 2D etiquette ronde effet sticker decoupe :
 *   - cercle blanc rayon 260 centre dans viewBox 1024
 *   - contour pointille gris a +25px = trait de decoupe sticker
 *   - marguerite scale 1.2 centrale + Magrit italic 48 sous
 *   - tagline IMPRIMERIE · IA uppercase letter-spacing 0.08em opacity 0.6
 *   - liseré pollen rectangle arrondi 320x8 centre sous Magrit
 *   - reference modele en bas opacity 0.4
 */
import {
  daisyMagrit,
  escapeXml,
  magritGradientsDefs,
  photoRealisticDefs,
  truncate,
} from "./_shared.ts";

export function etiquetteSvg(
  specs: { width: number; height: number; productName: string },
  theming: { primaryColor: string },
): string {
  const safeName = escapeXml(truncate(specs.productName, 35));
  const safeColor = theming.primaryColor || "#B7D3F2";
  const cx = 512;
  const cy = 512;
  const rSticker = 260;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
    <defs><linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${safeColor}" stop-opacity="0.05" /><stop offset="100%" stop-color="${safeColor}" stop-opacity="0.12" /></linearGradient>${photoRealisticDefs(safeColor)}${magritGradientsDefs()}</defs>
    <rect width="1024" height="1024" fill="url(#bgGrad)" /><circle cx="${cx}" cy="${cy}" r="${rSticker + 25}" fill="none" stroke="#94A3B8" stroke-width="2" stroke-dasharray="8 8" opacity="0.6"/>
    <g filter="url(#shadowDouble)"><circle cx="${cx}" cy="${cy}" r="${rSticker}" fill="#FFFFFF" /><circle cx="${cx}" cy="${cy}" r="${rSticker}" fill="url(#paperHighlight)" />${daisyMagrit(cx, cy - 40, 1.2)}
      <text x="${cx}" y="${cy + 50}" text-anchor="middle" font-family="Inter" font-style="italic" font-weight="500" font-size="48" fill="#0F172A" letter-spacing="-0.025em">Magrit</text><text x="${cx}" y="${cy + 85}" text-anchor="middle" font-family="Inter" font-weight="400" font-size="12" fill="#0F172A" letter-spacing="0.08em" opacity="0.6">IMPRIMERIE · IA</text><rect x="${cx - 160}" y="${cy + 140}" width="320" height="8" fill="#F5B529" rx="4" /></g>
    <text x="512" y="${cy + rSticker + 80}" text-anchor="middle" font-family="Inter" font-weight="500" font-size="11" fill="#0F172A" opacity="0.4">${safeName}</text>
  </svg>`;
}
