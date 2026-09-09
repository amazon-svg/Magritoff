/**
 * qa-review B5 (BLOQUANT, corrige) — assainissement des valeurs imprimees
 * pour les polices STANDARD `pdf-lib` (encodage WinAnsi/Windows-1252).
 *
 * Prouve par execution reelle (`pdf-lib@1.17.1`, `PDFPage.drawText()`) :
 * "Łukasz Nowak", "Ana ș Ț", "✓", tout emoji font lever
 * `Error: WinAnsi cannot encode "…"` — un client nomme ainsi, ou une
 * designation de ligne collee depuis un cahier des charges, rendait CE devis
 * precis definitivement inenvoyable tant que le gabarit restait actif,
 * l echappatoire de la reserve (j) (desactiver le gabarit) n ayant ici aucun
 * sens : la cause n est pas le gabarit.
 *
 * VERIFIE PAR EXECUTION REELLE (pas suppose), le meme jour, sur le meme
 * moteur : les caracteres francais usuels rendent SANS repli — "café à côté
 * œuf €", « guillemets » / tiret cadratin — / points de suspension… — tous
 * WinAnsi. La sanitization ci-dessous ne les touche donc JAMAIS : elle ne
 * s applique qu aux caracteres REELLEMENT hors du repertoire.
 *
 * Strategie, dans cet ordre :
 *  1. Le caractere est deja WinAnsi-safe (ASCII imprimable, Latin-1
 *     supplement 0xA0-0xFF, ou l un des symboles typographiques du bloc
 *     special Windows-1252 0x80-0x9F — €, œ/Œ, guillemets, tirets,
 *     puces, points de suspension…) -> conserve tel quel.
 *  2. Lettre "a barre" sans decomposition Unicode (Ł/ł, Đ/đ — Ø/ø sont deja
 *     WinAnsi, donc jamais dans cette liste) -> substitution EXPLICITE.
 *  3. Sinon, decomposition NFKD + suppression des marques diacritiques
 *     combinantes (U+0300-U+036F) : couvre la quasi-totalite des lettres
 *     d Europe centrale/orientale a caron/ogonek/virgule souscrite
 *     (č, ř, š, ž, ą, ę, ș, ț...), qui degradent alors vers leur lettre de
 *     base ASCII/Latin-1.
 *  4. Sinon (symboles, emoji, CJK...), remplace par `?` — visible plutot que
 *     silencieusement disparu, mais sans jamais faire planter la generation.
 *
 * Applique en DEUX endroits, en defense en profondeur (meme discipline que
 * le reste du sprint) : ici, a la resolution des valeurs
 * (`document-field-value-resolver.ts`, point d entree normal) ET dans
 * `quote-document-renderer.ts` juste avant `drawText()` (filet de securite
 * si un futur appelant du moteur ne passait pas par le resolveur).
 */

/** Codepoints Unicode du bloc special Windows-1252 (0x80-0x9F), tous valides en WinAnsi. */
const WIN1252_SPECIAL_BLOCK_CODEPOINTS: ReadonlySet<number> = new Set([
  0x20ac, // € (0x80)
  0x201a, // ‚ (0x82)
  0x0192, // ƒ (0x83)
  0x201e, // „ (0x84)
  0x2026, // … (0x85)
  0x2020, // † (0x86)
  0x2021, // ‡ (0x87)
  0x02c6, // ˆ (0x88)
  0x2030, // ‰ (0x89)
  0x0160, // Š (0x8A)
  0x2039, // ‹ (0x8B)
  0x0152, // Œ (0x8C)
  0x017d, // Ž (0x8E)
  0x2018, // ' (0x91)
  0x2019, // ' (0x92)
  0x201c, // " (0x93)
  0x201d, // " (0x94)
  0x2022, // • (0x95)
  0x2013, // – (0x96)
  0x2014, // — (0x97)
  0x02dc, // ˜ (0x98)
  0x2122, // ™ (0x99)
  0x0161, // š (0x9A)
  0x203a, // › (0x9B)
  0x0153, // œ (0x9C)
  0x017e, // ž (0x9E)
  0x0178, // Ÿ (0x9F)
]);

/** Lettres "a barre" ou apparentees, SANS decomposition NFKD, absentes de WinAnsi. */
const EXPLICIT_TRANSLITERATION_MAP: ReadonlyMap<string, string> = new Map([
  ['Ł', 'L'],
  ['ł', 'l'],
  ['Đ', 'D'],
  ['đ', 'd'],
  ['Ħ', 'H'],
  ['ħ', 'h'],
  ['Ŧ', 'T'],
  ['ŧ', 't'],
]);

const COMBINING_DIACRITICS_PATTERN = /[\u0300-\u036f]/g;

function isWinAnsiSafeCodePoint(codePoint: number): boolean {
  // `\n` (0x0A) : cesure STRUCTURELLE consommee par `layoutLines` (moteur de
  // dessin) pour scinder les lignes (ex. `customer.billing_address_block`) —
  // JAMAIS transmise a `font.encodeText()` telle quelle, donc jamais un
  // caractere a assainir. La retirer ici la remplacerait par `?` et
  // detruirait la mise en page du bloc adresse.
  if (codePoint === 0x0a) return true;
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true; // ASCII imprimable
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true; // Latin-1 supplement (accents francais usuels)
  return WIN1252_SPECIAL_BLOCK_CODEPOINTS.has(codePoint);
}

function isWinAnsiSafeString(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || !isWinAnsiSafeCodePoint(codePoint)) return false;
  }
  return true;
}

/**
 * Assainit `text` pour une police STANDARD `pdf-lib` (WinAnsi) : chaque
 * caractere hors repertoire est translittere ou, en dernier recours,
 * remplace par `?`. Fonction PURE, aucune dependance a `pdf-lib`.
 */
export function sanitizeForStandardPdfFont(text: string): string {
  if (isWinAnsiSafeString(text)) return text; // chemin rapide : cas de LOIN le plus frequent (francais courant).

  let result = '';
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined && isWinAnsiSafeCodePoint(codePoint)) {
      result += char;
      continue;
    }

    const explicit = EXPLICIT_TRANSLITERATION_MAP.get(char);
    if (explicit !== undefined) {
      result += explicit;
      continue;
    }

    const decomposed = char.normalize('NFKD').replace(COMBINING_DIACRITICS_PATTERN, '');
    if (decomposed.length > 0 && isWinAnsiSafeString(decomposed)) {
      result += decomposed;
      continue;
    }

    result += '?';
  }
  return result;
}

/** Applique `sanitizeForStandardPdfFont` a toutes les valeurs (chaines) d un enregistrement `champ -> valeur`. */
export function sanitizeFieldValues<T extends Record<string, string>>(values: T): T {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    sanitized[key] = sanitizeForStandardPdfFont(value);
  }
  return sanitized as T;
}
