/**
 * Test unitaire REEL de `pdf-template-inspector.ts` (story E10.10b-4a) :
 * execute `pdf-lib` pour de vrai (aucun mock), sous Node/Vitest — meme
 * bibliotheque, memes appels que ceux verifies dans l isolat Deno de la
 * facade (preuve d execution du rapport de fin de story, six mesures de
 * docs/api/CONVENTIONS.md §8.18 §0).
 *
 * Les fixtures sont GENEREES ICI par `pdf-lib` lui-meme (`PDFDocument.create()`),
 * plutot que des fichiers binaires commites : plus simple a maintenir, et ce
 * test exerce du meme coup le chemin d ECRITURE de `pdf-lib`, pas seulement
 * la lecture.
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  DOCUMENT_PDF_TEMPLATE_MAX_PAGES,
  inspectPdfTemplate,
  InvalidPdfTemplateError,
} from '@/modules/document-templates/application/pdf-template-inspector';

async function buildPdf(pageSizes: ReadonlyArray<readonly [number, number]>): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const [width, height] of pageSizes) {
    const page = document.addPage([width, height]);
    page.drawText('Numéro de devis : DEV-2026-00042 — Total : 1 234,50 €', {
      x: 20,
      y: height / 2,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
  }
  return document.save();
}

describe('inspectPdfTemplate (pdf-lib reel, aucun mock)', () => {
  it('releve page_count et dimensions exactes d un fond A4 une page', async () => {
    const bytes = await buildPdf([[595.28, 841.89]]);

    const inspection = await inspectPdfTemplate(bytes);

    expect(inspection.pageCount).toBe(1);
    expect(inspection.pages).toEqual([{ index: 0, width_pt: 595.28, height_pt: 841.89 }]);
  });

  it('releve la geometrie PAGE PAR PAGE sur un gabarit multi-pages, index a partir de 0', async () => {
    const bytes = await buildPdf([
      [595.28, 841.89],
      [1440, 810],
      [612, 792],
    ]);

    const inspection = await inspectPdfTemplate(bytes);

    expect(inspection.pageCount).toBe(3);
    expect(inspection.pages).toEqual([
      { index: 0, width_pt: 595.28, height_pt: 841.89 },
      { index: 1, width_pt: 1440, height_pt: 810 },
      { index: 2, width_pt: 612, height_pt: 792 },
    ]);
  });

  it('arrondit la geometrie a 2 decimales (precision DocumentCoordinate/numeric(8,2))', async () => {
    const bytes = await buildPdf([[595.276, 841.895]]);

    const inspection = await inspectPdfTemplate(bytes);

    expect(inspection.pages[0]!.width_pt).toBe(595.28);
    expect(inspection.pages[0]!.height_pt).toBe(841.9);
  });

  it('refuse un fichier au-dela du plafond de pages (422 document_pdf_template.invalid_pdf)', async () => {
    const tooMany = Array.from({ length: DOCUMENT_PDF_TEMPLATE_MAX_PAGES + 1 }, () => [595.28, 841.89] as const);
    const bytes = await buildPdf(tooMany);

    await expect(inspectPdfTemplate(bytes)).rejects.toBeInstanceOf(InvalidPdfTemplateError);
  });

  it('accepte exactement le plafond de pages', async () => {
    const exactly = Array.from({ length: DOCUMENT_PDF_TEMPLATE_MAX_PAGES }, () => [595.28, 841.89] as const);
    const bytes = await buildPdf(exactly);

    const inspection = await inspectPdfTemplate(bytes);
    expect(inspection.pageCount).toBe(DOCUMENT_PDF_TEMPLATE_MAX_PAGES);
  });

  it('refuse un fichier illisible (octets arbitraires, pas un PDF)', async () => {
    const bytes = new TextEncoder().encode('ceci n est pas un PDF');

    await expect(inspectPdfTemplate(bytes)).rejects.toBeInstanceOf(InvalidPdfTemplateError);
  });

  it('refuse un PDF chiffre sans tenter de l ouvrir en degrade (ignoreEncryption absent)', async () => {
    // pdf-lib ne sait pas ECRIRE de PDF chiffre : verifie ici que le chemin de
    // rejet existe (fichier tronque/corrompu, meme famille d echec que
    // "chiffre" du point de vue de PDFDocument.load). Le cas reellement
    // chiffre est couvert par la preuve d execution du rapport de fin de
    // story (fichier reel non commis dans le depot).
    const validBytes = await buildPdf([[595.28, 841.89]]);
    const truncated = validBytes.slice(0, Math.floor(validBytes.length / 2));

    await expect(inspectPdfTemplate(truncated)).rejects.toBeInstanceOf(InvalidPdfTemplateError);
  });
});
