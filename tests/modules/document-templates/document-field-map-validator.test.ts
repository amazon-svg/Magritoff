/**
 * E10.10b-4b — `validateDocumentFieldMap`/`maxRowsPerPage`
 * (`src/modules/document-templates/application/document-field-map-validator.ts`).
 *
 * Fonction PURE : aucune dependance a Supabase/HTTP. Test unitaire direct,
 * sans harnais de contrat ni base — c est la LOGIQUE DE CALCUL de ce lot
 * (regle #5 du rapport de fin de story dev-story).
 */
import { describe, expect, it } from 'vitest';
import {
  maxRowsPerPage,
  validateDocumentFieldMap,
} from '@/modules/document-templates/application/document-field-map-validator';
import type {
  DocumentFieldPlacementDto,
  DocumentPdfTemplatePageDto,
  ReplaceDocumentPdfTemplateFieldsCommand,
} from '@/modules/document-templates/api/contracts';

const PAGE_A4: DocumentPdfTemplatePageDto[] = [
  { index: 0, width_pt: 595.28, height_pt: 841.89 },
  { index: 1, width_pt: 595.28, height_pt: 841.89 },
];

function placement(overrides: Partial<DocumentFieldPlacementDto> = {}): DocumentFieldPlacementDto {
  return {
    field: 'quote.number',
    page_index: 0,
    x: 50,
    y: 50,
    max_lines: 1,
    align: 'left',
    font: 'helvetica',
    font_size: 10,
    color: '#111111',
    ...overrides,
  };
}

function command(
  overrides: Partial<ReplaceDocumentPdfTemplateFieldsCommand> = {},
): ReplaceDocumentPdfTemplateFieldsCommand {
  return { placements: [], lines_block: null, ...overrides };
}

describe('validateDocumentFieldMap', () => {
  it('carte vide : aucune erreur (etat legitime, contrat "une carte vide est acceptee")', () => {
    expect(validateDocumentFieldMap(PAGE_A4, command())).toEqual([]);
  });

  it('un placement valide, sans largeur, aligne a gauche : aucune erreur', () => {
    const errors = validateDocumentFieldMap(PAGE_A4, command({ placements: [placement()] }));
    expect(errors).toEqual([]);
  });

  it('page_index qui n existe pas dans le fond -> erreur sur ce champ', () => {
    const errors = validateDocumentFieldMap(PAGE_A4, command({ placements: [placement({ page_index: 7 })] }));
    expect(errors.some((error) => error.field === 'placements[0].page_index')).toBe(true);
  });

  it('coordonnee x/y hors des bornes de la page -> erreur', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({ placements: [placement({ x: 9999, y: 9999 })] }),
    );
    expect(errors.some((error) => error.field === 'placements[0].x')).toBe(true);
    expect(errors.some((error) => error.field === 'placements[0].y')).toBe(true);
  });

  it('un champ place deux fois -> erreur, meme a des coordonnees differentes', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({
        placements: [placement({ field: 'quote.number' }), placement({ field: 'quote.number', x: 200 })],
      }),
    );
    expect(errors.some((error) => error.field === 'placements[1].field')).toBe(true);
  });

  it('deux champs DIFFERENTS au meme endroit : aucune erreur (superposition visuelle acceptee, contrat)', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({
        placements: [
          placement({ field: 'totals.net_total', x: 100, y: 100 }),
          placement({ field: 'totals.total_incl_tax', x: 100, y: 100 }),
        ],
      }),
    );
    expect(errors).toEqual([]);
  });

  it('alignement centre ou droite SANS largeur -> erreur (DocumentTextAlign : exige une largeur)', () => {
    const center = validateDocumentFieldMap(PAGE_A4, command({ placements: [placement({ align: 'center' })] }));
    expect(center.some((error) => error.field === 'placements[0].align')).toBe(true);

    const right = validateDocumentFieldMap(PAGE_A4, command({ placements: [placement({ align: 'right' })] }));
    expect(right.some((error) => error.field === 'placements[0].align')).toBe(true);
  });

  it('alignement centre AVEC largeur : aucune erreur', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({ placements: [placement({ align: 'center', width: 100 })] }),
    );
    expect(errors).toEqual([]);
  });

  it('bloc de lignes valide, page existante, colonnes non dupliquees : aucune erreur', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({
        lines_block: {
          page_index: 0,
          first_row_baseline_y: 700,
          row_height: 14,
          rows_per_page: 20,
          continuation_page_index: 1,
          columns: [
            { field: 'line.label', x: 50, width: 300, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' },
            { field: 'line.price', x: 400, width: 100, align: 'right', font: 'helvetica', font_size: 10, color: '#111111' },
          ],
        },
      }),
    );
    expect(errors).toEqual([]);
  });

  it('lines_block.page_index inexistant -> erreur', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({
        lines_block: {
          page_index: 9,
          first_row_baseline_y: 100,
          row_height: 10,
          rows_per_page: 5,
          continuation_page_index: null,
          columns: [{ field: 'line.label', x: 10, width: 100, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' }],
        },
      }),
    );
    expect(errors.some((error) => error.field === 'lines_block.page_index')).toBe(true);
  });

  it('continuation_page_index inexistant -> erreur, independante de page_index', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({
        lines_block: {
          page_index: 0,
          first_row_baseline_y: 100,
          row_height: 10,
          rows_per_page: 5,
          continuation_page_index: 9,
          columns: [{ field: 'line.label', x: 10, width: 100, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' }],
        },
      }),
    );
    expect(errors.some((error) => error.field === 'lines_block.continuation_page_index')).toBe(true);
  });

  it('rows_per_page fait deborder le tableau sous le bas de la page -> erreur', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({
        lines_block: {
          page_index: 0,
          first_row_baseline_y: 50,
          row_height: 20,
          // 50 - (10-1)*20 = 50 - 180 = -130 < 0 : deborde.
          rows_per_page: 10,
          continuation_page_index: null,
          columns: [{ field: 'line.label', x: 10, width: 100, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' }],
        },
      }),
    );
    expect(errors.some((error) => error.field === 'lines_block.rows_per_page')).toBe(true);
  });

  it('rows_per_page au plafond exact (deborde a 0 pile) : aucune erreur', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({
        lines_block: {
          page_index: 0,
          // 100 - (6-1)*20 = 0 : au ras du bord, accepte.
          first_row_baseline_y: 100,
          row_height: 20,
          rows_per_page: 6,
          continuation_page_index: null,
          columns: [{ field: 'line.label', x: 10, width: 100, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' }],
        },
      }),
    );
    expect(errors).toEqual([]);
  });

  // ── E10.19a — sous-ensemble opposable PAR TYPE DE DOCUMENT ────────────────
  it('un champ order.* sur un gabarit quote (defaut) -> erreur', () => {
    const errors = validateDocumentFieldMap(PAGE_A4, command({ placements: [placement({ field: 'order.number' })] }));
    expect(errors.some((error) => error.field === 'placements[0].field')).toBe(true);
  });

  it('un champ quote.* sur un gabarit order -> erreur', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({ placements: [placement({ field: 'quote.number' })] }),
      'order',
    );
    expect(errors.some((error) => error.field === 'placements[0].field')).toBe(true);
  });

  it('un champ order.* sur un gabarit order : aucune erreur de sous-ensemble', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({ placements: [placement({ field: 'order.number' })] }),
      'order',
    );
    expect(errors).toEqual([]);
  });

  it('les familles communes (customer./totals./page.) valent pour les DEUX types', () => {
    const onOrder = validateDocumentFieldMap(
      PAGE_A4,
      command({ placements: [placement({ field: 'customer.company_name' })] }),
      'order',
    );
    expect(onOrder).toEqual([]);

    const onQuote = validateDocumentFieldMap(
      PAGE_A4,
      command({ placements: [placement({ field: 'totals.net_total' })] }),
      'quote',
    );
    expect(onQuote).toEqual([]);
  });

  it('une colonne de lignes utilisee deux fois -> erreur', () => {
    const errors = validateDocumentFieldMap(
      PAGE_A4,
      command({
        lines_block: {
          page_index: 0,
          first_row_baseline_y: 700,
          row_height: 14,
          rows_per_page: 20,
          continuation_page_index: null,
          columns: [
            { field: 'line.price', x: 50, width: 100, align: 'right', font: 'helvetica', font_size: 10, color: '#111111' },
            { field: 'line.price', x: 200, width: 100, align: 'right', font: 'helvetica', font_size: 10, color: '#111111' },
          ],
        },
      }),
    );
    expect(errors.some((error) => error.field === 'lines_block.columns[1].field')).toBe(true);
  });
});

describe('maxRowsPerPage', () => {
  it('reprend exactement l inegalite du contrat (first_row_baseline_y / row_height + 1)', () => {
    expect(maxRowsPerPage(100, 20)).toBe(6);
    expect(maxRowsPerPage(90, 20)).toBe(5);
    expect(maxRowsPerPage(0, 20)).toBe(1);
  });

  it('ne descend jamais sous 1, meme avec un pas de ligne demesure', () => {
    expect(maxRowsPerPage(10, 1000)).toBe(1);
  });

  it('se protege d un row_height nul ou negatif (division impossible)', () => {
    expect(maxRowsPerPage(100, 0)).toBe(1);
    expect(maxRowsPerPage(100, -5)).toBe(1);
  });
});
