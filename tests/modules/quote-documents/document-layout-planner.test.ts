/**
 * Test unitaire PUR de `planQuoteDocumentLayout` (story E10.10b-4c) : AUCUN
 * pdf-lib, AUCUN fichier PDF — une mesure de largeur FICTIVE et
 * deterministe (`fakeMeasure`) suffit a verifier le routage des champs par
 * famille, l insertion des pages de continuation et le repli/troncature du
 * texte. C est la separation deliberee documentee en tete de
 * `document-layout-planner.ts` : la logique delicate se teste sans ouvrir le
 * moindre fichier.
 */
import { describe, expect, it } from 'vitest';
import {
  layoutLines,
  planQuoteDocumentLayout,
  truncateToWidth,
  type PlanQuoteDocumentLayoutInput,
  type TextMeasurer,
} from '@/modules/quote-documents/application/document-layout-planner';
import type {
  DocumentFieldPlacementDto,
  DocumentLinesBlockDto,
  DocumentPdfTemplatePageDto,
} from '@/modules/document-templates/api/contracts';

/** 1 point par caractere, quelle que soit la police/le corps : simple, deterministe, suffisant pour verifier la LOGIQUE de repli/troncature. */
const fakeMeasure: TextMeasurer = (_font, _size, text) => text.length;

function pages(count: number): DocumentPdfTemplatePageDto[] {
  return Array.from({ length: count }, (_unused, index) => ({ index, width_pt: 595, height_pt: 842 }));
}

function placement(overrides: Partial<DocumentFieldPlacementDto> & Pick<DocumentFieldPlacementDto, 'field'>): DocumentFieldPlacementDto {
  return {
    page_index: 0,
    x: 50,
    y: 700,
    width: null,
    max_lines: 1,
    align: 'left',
    font: 'helvetica',
    font_size: 12,
    color: '#111111',
    ...overrides,
  };
}

function baseInput(overrides: Partial<PlanQuoteDocumentLayoutInput> = {}): PlanQuoteDocumentLayoutInput {
  return {
    pages: pages(1),
    placements: [],
    linesBlock: null,
    fieldValues: {},
    lineValues: [],
    ...overrides,
  };
}

describe('planQuoteDocumentLayout — routage des champs', () => {
  it('quote./customer. se dessinent UNE FOIS, sur la page declaree par le placement', () => {
    const plan = planQuoteDocumentLayout(
      baseInput({
        pages: pages(2),
        placements: [placement({ field: 'quote.number', page_index: 1 })],
        fieldValues: { 'quote.number': 'DEV-2026-00042' },
      }),
      fakeMeasure,
    );

    expect(plan.textBlocks).toHaveLength(1);
    expect(plan.textBlocks[0]).toMatchObject({ outputPageIndex: 1, lines: ['DEV-2026-00042'] });
  });

  it('un champ ABSENT de fieldValues ne produit AUCUN bloc (contrat : rien n est imprime, jamais un tiret)', () => {
    const plan = planQuoteDocumentLayout(
      baseInput({ placements: [placement({ field: 'totals.global_discount' })], fieldValues: {} }),
      fakeMeasure,
    );

    expect(plan.textBlocks).toHaveLength(0);
  });

  it('totals.* se dessinent sur la DERNIERE page produite, quelle que soit la page declaree par le placement', () => {
    const plan = planQuoteDocumentLayout(
      baseInput({
        pages: pages(3),
        placements: [placement({ field: 'totals.net_total', page_index: 0 })],
        fieldValues: { 'totals.net_total': '1234.50' },
      }),
      fakeMeasure,
    );

    expect(plan.textBlocks[0]?.outputPageIndex).toBe(2);
  });

  it('page.* se dessinent sur TOUTES les pages produites, valeurs 1-indexees', () => {
    const plan = planQuoteDocumentLayout(
      baseInput({ pages: pages(3), placements: [placement({ field: 'page.number_of_count' })] }),
      fakeMeasure,
    );

    expect(plan.textBlocks.map((block) => block.lines[0])).toEqual(['1/3', '2/3', '3/3']);
    expect(plan.textBlocks.map((block) => block.outputPageIndex)).toEqual([0, 1, 2]);
  });
});

describe('planQuoteDocumentLayout — debordement du bloc de lignes', () => {
  const linesBlock: DocumentLinesBlockDto = {
    page_index: 0,
    first_row_baseline_y: 700,
    row_height: 20,
    rows_per_page: 2,
    continuation_page_index: null,
    columns: [{ field: 'line.label', x: 50, width: 200, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' }],
  };

  it('sans debordement (lignes <= rows_per_page), AUCUNE page de continuation', () => {
    const plan = planQuoteDocumentLayout(
      baseInput({ linesBlock, lineValues: [{ 'line.label': 'Une ligne' }] }),
      fakeMeasure,
    );

    expect(plan.totalOutputPages).toBe(1);
    expect(plan.outputPageSources).toEqual([0]);
  });

  it('debordement : AJOUTE une page de continuation par tranche de rows_per_page en trop, recopiant continuation_page_index (ou page_index si absente)', () => {
    const plan = planQuoteDocumentLayout(
      baseInput({
        pages: pages(2), // page 1 = devis, page 2 = CGV
        linesBlock,
        lineValues: [
          { 'line.label': 'L1' },
          { 'line.label': 'L2' },
          { 'line.label': 'L3' },
        ],
      }),
      fakeMeasure,
    );

    // 3 lignes, 2 par page -> 2 pages de lignes + 1 page de CGV inchangee = 3.
    expect(plan.totalOutputPages).toBe(3);
    // La page de reprise recopie page_index (0, continuation_page_index absente) et s insere APRES elle, AVANT la page de CGV (index source 1).
    expect(plan.outputPageSources).toEqual([0, 0, 1]);

    const lineBlocks = plan.textBlocks.filter((block) => block.lines[0]?.startsWith('L'));
    expect(lineBlocks.map((block) => [block.outputPageIndex, block.lines[0]])).toEqual([
      [0, 'L1'],
      [0, 'L2'],
      [1, 'L3'],
    ]);
  });

  it('respecte continuation_page_index quand elle differe de page_index — recopie la page dediee, en PLUS de sa position normale (comportement documente, pas explicite au contrat)', () => {
    const plan = planQuoteDocumentLayout(
      baseInput({
        pages: pages(3), // 0 = devis, 1 = page de reprise dediee (sans en-tete), 2 = CGV
        linesBlock: { ...linesBlock, continuation_page_index: 1 },
        lineValues: [{ 'line.label': 'L1' }, { 'line.label': 'L2' }, { 'line.label': 'L3' }],
      }),
      fakeMeasure,
    );

    // Page 0 (devis), PUIS la copie de reprise (source 1), PUIS les pages de
    // base dans leur ordre d origine (1, 2) : la page dediee garde AUSSI sa
    // position normale — decision de rendu signalee au rapport de fin de
    // story, le contrat ne tranche pas explicitement ce cas.
    expect(plan.outputPageSources).toEqual([0, 1, 1, 2]);
  });

  it('les baselines des lignes descendent de row_height, remises a first_row_baseline_y sur chaque page de continuation', () => {
    const plan = planQuoteDocumentLayout(
      baseInput({
        pages: pages(1),
        linesBlock,
        lineValues: [{ 'line.label': 'L1' }, { 'line.label': 'L2' }, { 'line.label': 'L3' }],
      }),
      fakeMeasure,
    );

    const ys = plan.textBlocks.map((block) => block.y);
    expect(ys).toEqual([700, 680, 700]);
  });

  it('un devis SANS bloc de lignes ne produit aucun bloc de texte de ligne (choix legitime de l imprimeur, pas une erreur)', () => {
    const plan = planQuoteDocumentLayout(
      baseInput({ linesBlock: null, lineValues: [{ 'line.label': 'L1' }] }),
      fakeMeasure,
    );

    expect(plan.textBlocks).toHaveLength(0);
    expect(plan.totalOutputPages).toBe(1);
  });
});

describe('layoutLines / truncateToWidth', () => {
  const widthOf = (text: string) => text.length;

  it('width === null -> aucune limite, texte inchange', () => {
    expect(layoutLines(widthOf, 'un texte quelconque', null, 1)).toEqual(['un texte quelconque']);
  });

  it('max_lines = 1 : COUPE NET, jamais de repli (contrat)', () => {
    expect(layoutLines(widthOf, 'un texte beaucoup trop long', 10, 1)).toEqual(['un texte b']);
  });

  it('max_lines > 1 : replie par mots, au plus max_lines lignes', () => {
    const lines = layoutLines(widthOf, 'douze rue des imprimeurs', 10, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.every((line) => line.length <= 10)).toBe(true);
  });

  it('un saut de ligne explicite (\\n) force une cesure, jamais fusionnee avec la suite', () => {
    const lines = layoutLines(widthOf, '12 rue des Imprimeurs\n75011 Paris\nFrance', 30, 5);
    expect(lines).toEqual(['12 rue des Imprimeurs', '75011 Paris', 'France']);
  });

  it('truncateToWidth coupe a la plus longue sous-chaine qui tient', () => {
    expect(truncateToWidth(widthOf, 'abcdefghij', 4)).toBe('abcd');
    expect(truncateToWidth(widthOf, 'abc', 10)).toBe('abc');
  });
});
