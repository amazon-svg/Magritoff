/**
 * Planification PURE de la mise en page d un document (story E10.10b-4c).
 *
 * SEPAREE du moteur de dessin (`quote-document-renderer.ts`) pour une raison
 * de TESTABILITE : cette fonction ne depend PAS de `pdf-lib`, seulement d une
 * MESURE DE LARGEUR DE TEXTE injectee (`TextMeasurer`) — le moteur reel lui
 * passe `font.widthOfTextAtSize()` d une police `pdf-lib` embarquee, un test
 * unitaire lui passe une mesure FICTIVE deterministe. Toute la logique
 * delicate (routage des champs par famille, INSERTION des pages de
 * continuation, repli/troncature du texte) est donc verifiable SANS ouvrir
 * le moindre fichier PDF.
 *
 * Reprend `computeDocumentPageCount` (module `document-templates`, deplacee
 * par ce meme lot pour eviter toute divergence avec l apercu client de 4b).
 */
import type {
  DocumentFieldPlacementDto,
  DocumentFont,
  DocumentLinesBlockDto,
  DocumentPdfTemplatePageDto,
  DocumentTextAlign,
} from '../../document-templates/api/contracts.ts';
import { computeDocumentPageCount } from '../../document-templates/application/document-field-map-validator.ts';
import type { DocumentFieldValues, DocumentLineFieldValues } from './document-field-value-resolver.ts';

/** Pas vertical entre deux lignes d un meme champ replie (contrat, `DocumentFieldPlacement.max_lines`). */
export const WRAPPED_LINE_STEP_FACTOR = 1.2;

/** Mesure la largeur (points PDF) de `text` dans le role/corps donnes. Injectee pour decoupler ce fichier de `pdf-lib`. */
export type TextMeasurer = (font: DocumentFont, size: number, text: string) => number;

export type PlannedTextBlock = Readonly<{
  outputPageIndex: number;
  /** Deja repliee/tronquee : la premiere ligne se dessine a `y`, les suivantes descendent de `fontSize * 1.2`. */
  lines: readonly string[];
  x: number;
  y: number;
  width: number | null;
  align: DocumentTextAlign;
  font: DocumentFont;
  fontSize: number;
  color: string;
}>;

export type DocumentLayoutPlan = Readonly<{
  sourcePageCount: number;
  totalOutputPages: number;
  /** `outputPageSources[i]` = index de page du FOND a copier en position `i` du document produit. Un meme index source peut apparaitre plusieurs fois (pages de continuation). */
  outputPageSources: readonly number[];
  textBlocks: readonly PlannedTextBlock[];
}>;

export type PlanQuoteDocumentLayoutInput = Readonly<{
  pages: readonly DocumentPdfTemplatePageDto[];
  placements: readonly DocumentFieldPlacementDto[];
  linesBlock: DocumentLinesBlockDto | null;
  fieldValues: DocumentFieldValues;
  lineValues: readonly DocumentLineFieldValues[];
}>;

export function planQuoteDocumentLayout(input: PlanQuoteDocumentLayoutInput, measure: TextMeasurer): DocumentLayoutPlan {
  const sourcePageCount = input.pages.length;
  const outputIndexOfOriginal: number[] = Array.from({ length: sourcePageCount }, (_unused, index) => index);
  let outputPageSources: number[] = Array.from({ length: sourcePageCount }, (_unused, index) => index);

  const lineCount = input.lineValues.length;
  const totalLinePages = computeDocumentPageCount(lineCount, input.linesBlock);

  if (input.linesBlock && totalLinePages > 1) {
    const block = input.linesBlock;
    const continuationSourceIndex = block.continuation_page_index ?? block.page_index;
    const blockOutputIndex = outputIndexOfOriginal[block.page_index];
    if (blockOutputIndex === undefined) {
      throw new RangeError(`Page ${block.page_index} du bloc de lignes hors des bornes du fond.`);
    }
    const extraPages = totalLinePages - 1;
    const inserted = Array.from({ length: extraPages }, () => continuationSourceIndex);
    outputPageSources = [
      ...outputPageSources.slice(0, blockOutputIndex + 1),
      ...inserted,
      ...outputPageSources.slice(blockOutputIndex + 1),
    ];
    for (let index = 0; index < sourcePageCount; index += 1) {
      if (index > block.page_index) outputIndexOfOriginal[index] = (outputIndexOfOriginal[index] ?? index) + extraPages;
    }
  }

  const totalOutputPages = outputPageSources.length;
  const lastOutputPageIndex = totalOutputPages - 1;
  const textBlocks: PlannedTextBlock[] = [];

  // ── quote./customer. (une fois sur leur page) et totals. (derniere page) ──
  for (const placement of input.placements) {
    if (placement.field.startsWith('page.')) continue; // traite plus bas (toutes pages)
    const value = input.fieldValues[placement.field];
    if (value === undefined) continue; // valeur absente = rien imprime (contrat)

    const targetOutputIndex = placement.field.startsWith('totals.')
      ? lastOutputPageIndex
      : outputIndexOfOriginal[placement.page_index];
    if (targetOutputIndex === undefined) continue; // defensif : page hors bornes, deja validee a l ecriture de la carte

    const width = placement.width ?? null;
    const lines = layoutLines(
      (text) => measure(placement.font, placement.font_size, text),
      value,
      width,
      placement.max_lines,
    );
    textBlocks.push({
      outputPageIndex: targetOutputIndex,
      lines,
      x: placement.x,
      y: placement.y,
      width,
      align: placement.align,
      font: placement.font,
      fontSize: placement.font_size,
      color: placement.color,
    });
  }

  // ── page.* (dessinees sur TOUTES les pages produites) ───────────────────
  for (const placement of input.placements.filter((candidate) => candidate.field.startsWith('page.'))) {
    for (let outputIndex = 0; outputIndex < totalOutputPages; outputIndex += 1) {
      const value = pageFieldValue(
        placement.field as 'page.number' | 'page.count' | 'page.number_of_count',
        outputIndex,
        totalOutputPages,
      );
      textBlocks.push({
        outputPageIndex: outputIndex,
        lines: [value],
        x: placement.x,
        y: placement.y,
        width: placement.width ?? null,
        align: placement.align,
        font: placement.font,
        fontSize: placement.font_size,
        color: placement.color,
      });
    }
  }

  // ── Bloc de lignes ───────────────────────────────────────────────────────
  if (input.linesBlock && lineCount > 0) {
    const block = input.linesBlock;
    const blockOutputIndex = outputIndexOfOriginal[block.page_index] ?? block.page_index;

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const pageOffset = Math.floor(lineIndex / block.rows_per_page);
      const rowOnPage = lineIndex % block.rows_per_page;
      const outputPageIndex = blockOutputIndex + pageOffset;
      const baselineY = block.first_row_baseline_y - rowOnPage * block.row_height;
      const values = input.lineValues[lineIndex] ?? {};

      for (const column of block.columns) {
        const value = values[column.field];
        if (value === undefined) continue;
        const lines = layoutLines((text) => measure(column.font, column.font_size, text), value, column.width, 1);
        textBlocks.push({
          outputPageIndex,
          lines,
          x: column.x,
          y: baselineY,
          width: column.width,
          align: column.align,
          font: column.font,
          fontSize: column.font_size,
          color: column.color,
        });
      }
    }
  }

  return { sourcePageCount, totalOutputPages, outputPageSources, textBlocks };
}

function pageFieldValue(
  field: 'page.number' | 'page.count' | 'page.number_of_count',
  outputIndex: number,
  totalPages: number,
): string {
  if (field === 'page.number') return String(outputIndex + 1);
  if (field === 'page.count') return String(totalPages);
  return `${outputIndex + 1}/${totalPages}`;
}

/**
 * Decoupe `text` en au plus `maxLines` lignes tenant dans `width` (points
 * PDF), ou en une seule ligne COUPEE NETTE si `maxLines` vaut 1 (contrat,
 * `DocumentFieldPlacement.max_lines` : « 1 = pas de repli, coupe net »). Les
 * sauts de ligne explicites de `text` (`\n`, ex. `billing_address_block`)
 * sont des cesures FORCEES, jamais fusionnees avec la ligne suivante.
 * `width === null` -> aucune limite, la valeur est ecrite telle quelle.
 */
export function layoutLines(
  widthOf: (text: string) => number,
  text: string,
  width: number | null,
  maxLines: number,
): string[] {
  if (width === null) return [text];
  if (maxLines <= 1) return [truncateToWidth(widthOf, text.replace(/\n/g, ' '), width)];

  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const paragraph of paragraphs) {
    if (lines.length >= maxLines) break;
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
    let current = '';
    for (const word of words) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (current === '' || widthOf(candidate) <= width) {
        current = candidate;
        continue;
      }
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) {
        current = '';
        break;
      }
    }
    if (current !== '' && lines.length < maxLines) lines.push(current);
  }

  if (lines.length > maxLines) lines.length = maxLines;
  const lastIndex = lines.length - 1;
  if (lastIndex >= 0) lines[lastIndex] = truncateToWidth(widthOf, lines[lastIndex]!, width);
  return lines;
}

/** Recherche dichotomique de la plus longue coupe de `text` dont la largeur mesuree tient dans `width`. */
export function truncateToWidth(widthOf: (text: string) => number, text: string, width: number): string {
  if (widthOf(text) <= width) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (widthOf(text.slice(0, mid)) <= width) low = mid;
    else high = mid - 1;
  }
  return text.slice(0, low);
}
