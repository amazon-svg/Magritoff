/**
 * E10.10b-4b — conversion point PDF <-> pixel ecran
 * (`src/modules/document-templates/ui/workspace/field-editor/pdf-coordinates.ts`).
 *
 * Fonctions PURES : testees sans DOM, sans PDF.js. Reutilisees a la fois par
 * l editeur de placement et le calque d apercu (wireframe §2) — un bug ici
 * decalerait les deux de la meme facon, d ou l importance de le couvrir
 * isolement.
 */
import { describe, expect, it } from 'vitest';
import {
  computeDocumentPageCount,
  moveTableWithinPage,
  tableAnchorBounds,
  pdfPointToScreenPixel,
  scaleToFitWidth,
  screenPixelToPdfPoint,
} from '@/modules/document-templates/ui/workspace/field-editor/pdf-coordinates';

describe('pdfPointToScreenPixel / screenPixelToPdfPoint', () => {
  it('origine PDF (bas-gauche) -> coin bas-gauche ecran, a l echelle 1', () => {
    const pageHeightPt = 841.89;
    const pixel = pdfPointToScreenPixel({ x: 0, y: 0 }, pageHeightPt, 1);
    expect(pixel.x).toBeCloseTo(0);
    expect(pixel.y).toBeCloseTo(pageHeightPt);
  });

  it('coin haut-gauche PDF (y = hauteur de page) -> coin haut-gauche ecran (y = 0)', () => {
    const pageHeightPt = 841.89;
    const pixel = pdfPointToScreenPixel({ x: 0, y: pageHeightPt }, pageHeightPt, 1);
    expect(pixel.y).toBeCloseTo(0);
  });

  it('applique l echelle sur x ET y', () => {
    const pixel = pdfPointToScreenPixel({ x: 100, y: 100 }, 800, 2);
    expect(pixel.x).toBeCloseTo(200);
    expect(pixel.y).toBeCloseTo((800 - 100) * 2);
  });

  it('screenPixelToPdfPoint est la reciproque EXACTE de pdfPointToScreenPixel', () => {
    const pageHeightPt = 841.89;
    const scale = 1.37;
    const original = { x: 123.45, y: 678.9 };

    const pixel = pdfPointToScreenPixel(original, pageHeightPt, scale);
    const roundTrip = screenPixelToPdfPoint(pixel, pageHeightPt, scale);

    expect(roundTrip.x).toBeCloseTo(original.x, 6);
    expect(roundTrip.y).toBeCloseTo(original.y, 6);
  });

  it('un point qui monte sur l ecran (y ecran diminue) correspond a un point qui monte en PDF (y PDF augmente)', () => {
    const pageHeightPt = 800;
    const bas = pdfPointToScreenPixel({ x: 0, y: 100 }, pageHeightPt, 1);
    const haut = pdfPointToScreenPixel({ x: 0, y: 200 }, pageHeightPt, 1);
    expect(haut.y).toBeLessThan(bas.y);
  });
});

describe('scaleToFitWidth', () => {
  it('rend le ratio pixels/point pour une page A4 dans un conteneur de 600 px', () => {
    expect(scaleToFitWidth(595.28, 600)).toBeCloseTo(600 / 595.28, 6);
  });

  it('ne divise jamais par zero (page de largeur nulle -> echelle neutre)', () => {
    expect(scaleToFitWidth(0, 600)).toBe(1);
  });
});

describe('computeDocumentPageCount (qa-review R6 — jamais code en dur dans le jeu de donnees d exemple)', () => {
  it('aucun bloc de lignes -> toujours 1 page', () => {
    expect(computeDocumentPageCount(50, null)).toBe(1);
  });

  it('le nombre de lignes tient dans rows_per_page -> 1 page', () => {
    expect(computeDocumentPageCount(2, { rows_per_page: 10 })).toBe(1);
    expect(computeDocumentPageCount(10, { rows_per_page: 10 })).toBe(1);
  });

  it('deborde d une page de continuation quand les lignes depassent rows_per_page', () => {
    expect(computeDocumentPageCount(11, { rows_per_page: 10 })).toBe(2);
    expect(computeDocumentPageCount(20, { rows_per_page: 10 })).toBe(2);
    expect(computeDocumentPageCount(21, { rows_per_page: 10 })).toBe(3);
  });

  it('se protege d un rows_per_page nul ou negatif (division impossible) -> 1 page', () => {
    expect(computeDocumentPageCount(50, { rows_per_page: 0 })).toBe(1);
    expect(computeDocumentPageCount(50, { rows_per_page: -5 })).toBe(1);
  });

  it('reagit a un CHANGEMENT de rows_per_page sur le MEME nombre de lignes (jamais une valeur figee)', () => {
    const totalLines = 22;
    expect(computeDocumentPageCount(totalLines, { rows_per_page: 10 })).toBe(3);
    expect(computeDocumentPageCount(totalLines, { rows_per_page: 25 })).toBe(1);
  });
});


describe('déplacement du tableau aux bords de page', () => {
  const block = {
    page_index: 0, first_row_baseline_y: 400, row_height: 20, rows_per_page: 10,
    continuation_page_index: null,
    columns: [
      { field: 'line.label' as const, x: 120, width: 180, align: 'left' as const, font: 'helvetica' as const, font_size: 10, color: '#111111' },
      { field: 'line.quantity' as const, x: 40, width: 60, align: 'right' as const, font: 'helvetica' as const, font_size: 10, color: '#111111' },
    ],
  };

  it('préserve les espacements même si la première colonne n’est pas la plus à gauche', () => {
    expect(tableAnchorBounds(block, 600)).toEqual({ min: 80, max: 420 });
    const left = moveTableWithinPage(block, { x: -100, y: 400 }, 600, 800);
    expect(left.columns.map(c => c.x)).toEqual([80, 0]);
    const right = moveTableWithinPage(block, { x: 900, y: 400 }, 600, 800);
    expect(right.columns.map(c => c.x)).toEqual([420, 340]);
    expect(right.columns[0].x + right.columns[0].width).toBe(600);
  });

  it('ajuste la capacité immédiatement au déplacement vers le bas, sans panneau Tableau monté', () => {
    const moved = moveTableWithinPage(block, { x: 120, y: 39 }, 600, 800);
    expect(moved.rows_per_page).toBe(2);
    expect(moved.first_row_baseline_y - (moved.rows_per_page - 1) * moved.row_height).toBeGreaterThanOrEqual(0);
    expect(moveTableWithinPage(block, { x: 120, y: 900 }, 600, 800).first_row_baseline_y).toBe(800);
    expect(moveTableWithinPage(block, { x: 120, y: -1 }, 600, 800).rows_per_page).toBe(1);
  });
});
