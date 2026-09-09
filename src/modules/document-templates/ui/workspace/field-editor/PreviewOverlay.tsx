/**
 * Mode Aperçu (wireframe ecran D) : calque CLIENT superpose au rendu PDF.js
 * du fond, PAS un appel a un moteur de generation (qui n existe pas encore,
 * E10.10b-4c). Reutilise EXACTEMENT la meme conversion point-PDF <-> pixel
 * que l editeur de placement (`pdf-coordinates.ts`).
 *
 * ECART SIGNALE (E3) : n affiche que la PREMIERE page rendue. Repliquer la
 * logique de recopie de page cote client aurait dedouble la logique du futur
 * moteur E10.10b-4c sans qu il existe encore pour la confronter. Consequence
 * tenue explicitement (qa-review R2) : un gabarit a plusieurs pages, ou un
 * devis d exemple qui deborderait sur une page de continuation, l affiche en
 * PERMANENCE (pas seulement quand "Simuler un devis long" est coche), et les
 * familles `totals.`/`page.` (dessinees sur la DERNIERE page / TOUTES les
 * pages du document REEL) portent un repere visuel distinct des champs
 * `quote.`/`customer.` (dessines UNE fois, sur LEUR page) : rendus tous deux
 * ici sur la page 1 par construction de cet apercu, mais le repere rappelle
 * que ce n est pas forcement leur page finale.
 */
import { useRef } from 'react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import type { DocumentFieldId, DocumentPdfTemplateFieldMapDto, DocumentPdfTemplatePageDto } from '@/modules/document-templates/api/contracts';
import { computeDocumentPageCount, pdfPointToScreenPixel, scaleToFitWidth } from './pdf-coordinates';
import { usePdfPageCanvas } from './usePdfPageCanvas';
import type { SampleQuote } from './sample-quote';

const CANVAS_WIDTH_PX = 480;

export type PreviewOverlayProps = Readonly<{
  backgroundUrl: string | null;
  pages: readonly DocumentPdfTemplatePageDto[];
  fieldMap: DocumentPdfTemplateFieldMapDto;
  sample: SampleQuote;
  /** E10.19a — copie generique ("devis"/"commande") selon `document_type` du gabarit apercu. */
  documentTypeLabel: 'devis' | 'commande';
  simulateLong: boolean;
  onToggleLong(value: boolean): void;
  onExit(): void;
}>;

/** Familles dessinees sur la DERNIERE page / TOUTES les pages du document REEL (contrat `DocumentFieldId`), jamais garanties sur la page 1 comme cet apercu les montre. */
function isPageDependentFamily(field: DocumentFieldId): boolean {
  return field.startsWith('totals.') || field.startsWith('page.');
}

export function PreviewOverlay({
  backgroundUrl,
  pages,
  fieldMap,
  sample,
  documentTypeLabel,
  simulateLong,
  onToggleLong,
  onExit,
}: PreviewOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const render = usePdfPageCanvas(canvasRef, backgroundUrl, 0, CANVAS_WIDTH_PX);
  const page = pages[0];
  const scale = page ? scaleToFitWidth(page.width_pt, CANVAS_WIDTH_PX) : 1;

  // qa-review R6 : JAMAIS lu depuis le jeu de donnees statique — recalcule a
  // chaque rendu depuis le REGLAGE REEL du gabarit (`rows_per_page`) et le
  // nombre de lignes de l echantillon actuellement choisi.
  const computedPageCount = computeDocumentPageCount(sample.lines.length, fieldMap.lines_block);
  const dynamicFieldValues: Partial<Record<DocumentFieldId, string>> = {
    'page.number': '1',
    'page.count': String(computedPageCount),
    'page.number_of_count': `1/${computedPageCount}`,
  };

  // qa-review R2 : mention PERMANENTE des lors qu une des deux causes de
  // multi-page s applique — plus seulement quand "Simuler un devis long"
  // est coche (un gabarit a 2 pages avec des champs sur la page 2 etait
  // sinon silencieusement invisible, sans aucun avertissement).
  const templateHasMultiplePages = pages.length > 1;
  const linesOverflowPages = computedPageCount > 1;
  const showsMultiPageNotice = templateHasMultiplePages || linesOverflowPages;

  return (
    <div className="fixed inset-0 z-50 bg-paper flex flex-col" data-testid={TEST_IDS.documentTemplateFields.previewOverlay}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line-2">
        <button
          type="button"
          onClick={onExit}
          data-testid={TEST_IDS.documentTemplateFields.exitPreviewBtn}
          className="text-sm text-ink-2 hover:text-ink flex items-center gap-1"
        >
          ◂ Quitter l’aperçu
        </button>
        <h2 className="text-sm font-bold text-ink">Aperçu — {documentTypeLabel} d’exemple</h2>
        <label className="flex items-center gap-2 text-xs text-ink-2">
          <input
            type="checkbox"
            checked={simulateLong}
            data-testid={TEST_IDS.documentTemplateFields.previewLongCheckbox}
            onChange={(event) => onToggleLong(event.target.checked)}
          />
          {documentTypeLabel === 'commande' ? 'Simuler une commande longue (2 pages)' : 'Simuler un devis long (2 pages)'}
        </label>
      </div>

      <div className="flex-1 overflow-auto flex flex-col items-center py-8 gap-4">
        <div className="relative border border-line-2 shadow-md" style={{ width: CANVAS_WIDTH_PX }}>
          <canvas ref={canvasRef} className="block w-full" />
          {render.loading && <p className="text-xs text-ink-muted p-2">Chargement du fond…</p>}
          {render.error && <p className="text-xs text-err-fg p-2">{render.error}</p>}

          {page &&
            fieldMap.placements.map((placement) => {
              const value = dynamicFieldValues[placement.field] ?? sample.fields[placement.field];
              if (value === undefined) return null;
              const pageDependent = isPageDependentFamily(placement.field);
              const pixel = pdfPointToScreenPixel({ x: placement.x, y: placement.y }, page.height_pt, scale);
              return (
                <span
                  key={placement.field}
                  className={`absolute whitespace-pre text-ink ${
                    pageDependent ? 'outline-dashed outline-1 outline-amber-500/70' : ''
                  }`}
                  title={
                    pageDependent
                      ? placement.field.startsWith('totals.')
                        ? 'Dessiné sur la DERNIÈRE page du document réel — ici représenté sur la page 1 par simplification de cet aperçu.'
                        : 'Dessiné sur TOUTES les pages du document réel — ici représenté sur la page 1 par simplification de cet aperçu.'
                      : undefined
                  }
                  style={{
                    left: pixel.x,
                    top: pixel.y - placement.font_size * scale,
                    fontSize: placement.font_size * scale,
                    color: placement.color,
                    fontWeight: placement.font.includes('bold') ? 700 : 400,
                    fontStyle: placement.font.includes('oblique') || placement.font.includes('italic') ? 'italic' : 'normal',
                    fontFamily: placement.font.startsWith('times') ? 'serif' : placement.font.startsWith('courier') ? 'monospace' : 'sans-serif',
                    textAlign: placement.align,
                    width: placement.width ? placement.width * scale : undefined,
                  }}
                >
                  {value}
                </span>
              );
            })}

          {page && fieldMap.lines_block && fieldMap.lines_block.page_index === 0 && (
            <>
              {sample.lines.slice(0, fieldMap.lines_block.rows_per_page).map((line, rowIndex) => {
                const block = fieldMap.lines_block!;
                const y = block.first_row_baseline_y - rowIndex * block.row_height;
                if (y < 0) return null;
                return (
                  <span key={rowIndex} className="absolute" style={{ left: 0, top: 0 }}>
                    {block.columns.map((column, columnIndex) => {
                      const pixel = pdfPointToScreenPixel({ x: column.x, y }, page.height_pt, scale);
                      return (
                        <span
                          key={columnIndex}
                          className="absolute whitespace-pre text-ink"
                          style={{
                            left: pixel.x,
                            top: pixel.y - column.font_size * scale,
                            fontSize: column.font_size * scale,
                            color: column.color,
                            width: column.width * scale,
                            textAlign: column.align,
                          }}
                        >
                          {line[column.field]}
                        </span>
                      );
                    })}
                  </span>
                );
              })}
            </>
          )}
        </div>

        <div className="text-xs text-ink-muted text-center max-w-md px-4 space-y-1">
          <p>
            Ceci est un aperçu avec des données fictives. Le document réel sera généré avec les vraies données du
            client.
          </p>
          {showsMultiPageNotice && (
            <p className="text-amber-700">
              {templateHasMultiplePages && linesOverflowPages
                ? `Ce gabarit compte ${pages.length} page(s) et ce devis d’exemple en occuperait au moins ${computedPageCount} — seule la page 1 est représentée dans cet aperçu.`
                : templateHasMultiplePages
                  ? `Ce gabarit compte ${pages.length} page(s) — seule la page 1 est représentée dans cet aperçu.`
                  : `Ce devis d’exemple occuperait au moins ${computedPageCount} page(s) avec ce réglage de lignes par page — seule la page 1 est représentée dans cet aperçu.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
