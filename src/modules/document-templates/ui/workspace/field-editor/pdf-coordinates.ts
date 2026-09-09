/**
 * Conversion POINT PDF <-> PIXEL ECRAN (E10.10b-4b).
 *
 * Fonctions PURES, sans DOM ni PDF.js : c est le referentiel que le contrat
 * impose (`DocumentCoordinate`, origine BAS-GAUCHE, `y` vers le HAUT) converti
 * vers/depuis le referentiel du navigateur (origine HAUT-GAUCHE, `y` vers le
 * BAS) — la seule conversion de ce type dans tout l ecran, reutilisee A LA
 * FOIS par l editeur de placement ET par le calque d aperçu (wireframe §2,
 * decision UX "reutilise EXACTEMENT la meme conversion").
 */

export type PdfPoint = Readonly<{ x: number; y: number }>;
export type ScreenPixel = Readonly<{ x: number; y: number }>;

/**
 * Convertit une coordonnee PDF (points, origine bas-gauche) en position
 * ecran (pixels CSS, origine haut-gauche), pour une page de hauteur
 * `pageHeightPt` rendue a l echelle `scale` (pixels par point).
 */
export function pdfPointToScreenPixel(point: PdfPoint, pageHeightPt: number, scale: number): ScreenPixel {
  return {
    x: point.x * scale,
    y: (pageHeightPt - point.y) * scale,
  };
}

/** Reciproque exacte de `pdfPointToScreenPixel` : pixel ecran -> point PDF. */
export function screenPixelToPdfPoint(pixel: ScreenPixel, pageHeightPt: number, scale: number): PdfPoint {
  return {
    x: pixel.x / scale,
    y: pageHeightPt - pixel.y / scale,
  };
}

/** Echelle (pixels par point PDF) pour afficher une page de largeur `pageWidthPt` dans un conteneur de `containerWidthPx` pixels. */
export function scaleToFitWidth(pageWidthPt: number, containerWidthPx: number): number {
  if (pageWidthPt <= 0) return 1;
  return containerWidthPx / pageWidthPt;
}

/**
 * Plafond de `rows_per_page` compatible avec l espace REELLEMENT disponible
 * (wireframe §2, ecran C : "Maximum sur cette page"). Reexporte ici pour que
 * l UI n importe qu un seul module de calcul geometrique ; la source de
 * verite reste `document-field-map-validator.ts` (module `application/`,
 * partage avec la validation serveur-side du service).
 */
export { maxRowsPerPage } from '@/modules/document-templates/application/document-field-map-validator';

/**
 * Nombre de pages qu un devis de `totalLines` lignes ferait tenir avec ce
 * bloc de lignes. Fonction PURE, utilisee par le mode Apercu (qa-review R6)
 * pour ne JAMAIS coder en dur un nombre de pages dans le jeu de donnees
 * d exemple — la valeur depend du REGLAGE REEL du gabarit en cours d edition
 * (`rows_per_page`), qui change a chaque reglage de l imprimeur.
 *
 * DEPLACEE dans `application/document-field-map-validator.ts` par
 * E10.10b-4c (moteur de generation serveur) : MEME calcul, reexporte ICI
 * pour ne rien casser des imports existants de l editeur — la consigne du
 * cadrage 4c est de reutiliser ce calcul plutot que d en ecrire un second qui
 * pourrait diverger entre l apercu client et le moteur reel.
 *
 * Ne modelise QUE le debordement des LIGNES ; la page de reprise elle-meme
 * (`continuation_page_index`) n est pas rendue dans l apercu (ecart E3,
 * signale au rapport de fin de story 4b) — ce nombre reste donc un MINIMUM
 * cote apercu, pas une garantie du rendu final que produit E10.10b-4c (qui,
 * lui, rend bien la page de reprise).
 */
export { computeDocumentPageCount } from '@/modules/document-templates/application/document-field-map-validator';
