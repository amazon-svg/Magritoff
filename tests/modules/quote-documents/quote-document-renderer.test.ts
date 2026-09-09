/**
 * Test unitaire REEL de `renderQuoteDocument` (story E10.10b-4c) : execute
 * `pdf-lib` pour de vrai (aucun mock, meme discipline que
 * `pdf-template-inspector.test.ts` en 4a).
 *
 * La logique de MISE EN PAGE (routage des champs, insertion des pages de
 * continuation, repli/troncature) est deja verifiee EXHAUSTIVEMENT, sans
 * pdf-lib, par `document-layout-planner.test.ts` — ce fichier-ci ne verifie
 * QUE ce que ce test-la ne peut pas couvrir : l EXECUTION mecanique reelle
 * (fond illisible, geometrie incoherente, nombre de pages produites,
 * ecriture effective sans exception, rendu correct des accents/`€`).
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  renderQuoteDocument,
  QuoteDocumentRenderError,
  type RenderQuoteDocumentInput,
} from '@/modules/quote-documents/application/quote-document-renderer';
import type { DocumentFieldPlacementDto, DocumentPdfTemplatePageDto } from '@/modules/document-templates/api/contracts';

async function buildBackground(pageSizes: ReadonlyArray<readonly [number, number]>): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (const [width, height] of pageSizes) document.addPage([width, height]);
  return document.save();
}

function pagesOf(sizes: ReadonlyArray<readonly [number, number]>): DocumentPdfTemplatePageDto[] {
  return sizes.map(([width_pt, height_pt], index) => ({ index, width_pt, height_pt }));
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

describe('renderQuoteDocument (pdf-lib reel, aucun mock)', () => {
  it('produit un PDF VALIDE (rechargeable par pdf-lib) avec le nombre de pages attendu', async () => {
    const backgroundBytes = await buildBackground([
      [595.28, 841.89],
      [595.28, 841.89],
    ]);
    const input: RenderQuoteDocumentInput = {
      backgroundBytes,
      pages: pagesOf([
        [595.28, 841.89],
        [595.28, 841.89],
      ]),
      placements: [
        placement({ field: 'quote.number', page_index: 0 }),
        placement({ field: 'customer.company_name', page_index: 1 }),
        placement({ field: 'totals.net_total', page_index: 0 }),
        placement({ field: 'page.number_of_count', page_index: 0, y: 20 }),
      ],
      linesBlock: null,
      fieldValues: {
        'quote.number': 'DEV-2026-00042',
        'customer.company_name': 'Établissements Dupont & Fils',
        'totals.net_total': '1 234,50 €',
      },
      lineValues: [],
    };

    const rendered = await renderQuoteDocument(input);

    expect(rendered.pageCount).toBe(2);
    expect(rendered.bytes.byteLength).toBeGreaterThan(0);
    const reloaded = await PDFDocument.load(rendered.bytes);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it('accents francais et « € » ne font pas echouer le rendu (police standard, mesure 4 de la preuve 4a reprise ici)', async () => {
    const backgroundBytes = await buildBackground([[595.28, 841.89]]);
    const input: RenderQuoteDocumentInput = {
      backgroundBytes,
      pages: pagesOf([[595.28, 841.89]]),
      placements: [placement({ field: 'customer.company_name' })],
      linesBlock: null,
      fieldValues: { 'customer.company_name': 'É à ç œ € — 1 234,50 €' },
      lineValues: [],
    };

    await expect(renderQuoteDocument(input)).resolves.toMatchObject({ pageCount: 1 });
  });

  it('debordement du bloc de lignes : le document produit porte bien le nombre de pages du plan (1 page de reprise ajoutee)', async () => {
    const backgroundBytes = await buildBackground([
      [595.28, 841.89],
      [595.28, 841.89],
    ]);
    const input: RenderQuoteDocumentInput = {
      backgroundBytes,
      pages: pagesOf([
        [595.28, 841.89],
        [595.28, 841.89],
      ]),
      placements: [],
      linesBlock: {
        page_index: 0,
        first_row_baseline_y: 700,
        row_height: 20,
        rows_per_page: 2,
        continuation_page_index: null,
        columns: [{ field: 'line.label', x: 50, width: 200, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' }],
      },
      fieldValues: {},
      lineValues: [{ 'line.label': 'L1' }, { 'line.label': 'L2' }, { 'line.label': 'L3' }],
    };

    const rendered = await renderQuoteDocument(input);

    expect(rendered.pageCount).toBe(3);
    const reloaded = await PDFDocument.load(rendered.bytes);
    expect(reloaded.getPageCount()).toBe(3);
  });

  it('rejette un fond illisible (traduit en 500 quote.document_generation_failed cote route)', async () => {
    const input: RenderQuoteDocumentInput = {
      backgroundBytes: new TextEncoder().encode('pas un PDF'),
      pages: [],
      placements: [],
      linesBlock: null,
      fieldValues: {},
      lineValues: [],
    };

    await expect(renderQuoteDocument(input)).rejects.toBeInstanceOf(QuoteDocumentRenderError);
  });

  it('rejette une geometrie incoherente avec le fond reel (defense en profondeur)', async () => {
    const backgroundBytes = await buildBackground([[595.28, 841.89]]);
    const input: RenderQuoteDocumentInput = {
      backgroundBytes,
      pages: pagesOf([
        [595.28, 841.89],
        [595.28, 841.89],
      ]), // 2 pages attendues, le fond n en a qu 1.
      placements: [],
      linesBlock: null,
      fieldValues: {},
      lineValues: [],
    };

    await expect(renderQuoteDocument(input)).rejects.toBeInstanceOf(QuoteDocumentRenderError);
  });

  it('un devis sans aucun placement ni bloc de lignes produit quand meme un document (le fond, tel quel)', async () => {
    const backgroundBytes = await buildBackground([[595.28, 841.89]]);
    const input: RenderQuoteDocumentInput = {
      backgroundBytes,
      pages: pagesOf([[595.28, 841.89]]),
      placements: [],
      linesBlock: null,
      fieldValues: {},
      lineValues: [],
    };

    const rendered = await renderQuoteDocument(input);
    expect(rendered.pageCount).toBe(1);
  });
});
