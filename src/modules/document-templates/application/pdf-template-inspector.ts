/**
 * Inspection PURE d un fond PDF depose (story E10.10b-4a).
 *
 * Aucun acces reseau, aucun acces base : recoit des octets deja telecharges
 * (par l adaptateur Supabase, depuis le bucket prive `document_pdf_templates`)
 * et rend la geometrie que `api_confirm_document_pdf_template_upload`
 * enregistre. C EST LE SEUL ENDROIT DE CE LOT QUI IMPORTE `pdf-lib` — le
 * moteur de GENERATION (`renderQuoteDocument`) est hors perimetre de 4a
 * (E10.10b-4c, docs/api/CONVENTIONS.md §8.18 §5/§6).
 *
 * Preuve d execution prealable a ce code (rapport de fin de story,
 * `docs/api/CONVENTIONS.md` §8.18 §0, six mesures) : `npm:pdf-lib@1.17.1`
 * charge et s execute dans un isolat Deno SANS permission reseau
 * supplementaire (contrairement a `@resvg/resvg-wasm`, qui va chercher son
 * binaire sur unpkg) ; un PDF Canva et un PDF InDesign reels s ouvrent et
 * rendent leur geometrie exacte ; l ecriture de texte a une coordonnee donnee
 * respecte le referentiel BAS-GAUCHE documente par le contrat ; les polices
 * standard (`StandardFonts.Helvetica`) rendent correctement `é/à/ç/œ/€` — le
 * repli sur une police libre embarquee (reserve (e) du contrat) N EST PAS
 * necessaire, mais reste a la charge du moteur de generation (4c), jamais de
 * ce module.
 *
 * Import `npm:` : le bare specifier `pdf-lib` est resolu par
 * `supabase/functions/magrit-api/deno.json` (import map, meme patron que
 * `zod`) sous Deno, et par `node_modules/pdf-lib` (package.json) sous
 * Vitest/tsc. Aucune des deux resolutions n est ecrite ici.
 */
import { PDFDocument } from 'pdf-lib';
import type { DocumentPdfTemplatePageDto } from '../api/contracts.ts';

/** Plafond de pages d un gabarit (contrat : `document_pdf_template.invalid_pdf` au-dela). */
export const DOCUMENT_PDF_TEMPLATE_MAX_PAGES = 10;

/**
 * Le fichier depose n est pas un PDF exploitable : illisible, chiffre, ou
 * au-dela de `DOCUMENT_PDF_TEMPLATE_MAX_PAGES` pages (422
 * `document_pdf_template.invalid_pdf`). L appelant (adaptateur) retire
 * l objet du stockage AVANT de rendre cette erreur — pas la responsabilite de
 * ce module, qui n a aucun acces au stockage.
 */
export class InvalidPdfTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPdfTemplateError';
  }
}

export type PdfTemplateInspection = Readonly<{
  pageCount: number;
  pages: readonly DocumentPdfTemplatePageDto[];
}>;

/**
 * Ouvre le fichier, en releve la geometrie page par page (en points PDF,
 * arrondis a 2 decimales — meme precision que `DocumentCoordinate`,
 * `numeric(8,2)` en base). Leve `InvalidPdfTemplateError` si le fichier ne
 * s ouvre pas (corrompu, chiffre) ou depasse le plafond de pages.
 */
export async function inspectPdfTemplate(bytes: Uint8Array): Promise<PdfTemplateInspection> {
  let document: PDFDocument;
  try {
    // `ignoreEncryption` volontairement ABSENT (defaut `false`) : un PDF
    // chiffre doit etre refuse, pas silencieusement ouvert en lecture
    // degradee (contrat : "illisible, chiffre, ou au-dela de 10 pages").
    document = await PDFDocument.load(bytes);
  } catch (cause) {
    throw new InvalidPdfTemplateError(
      `Fichier PDF illisible ou chiffre : ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  const pageCount = document.getPageCount();
  if (pageCount < 1 || pageCount > DOCUMENT_PDF_TEMPLATE_MAX_PAGES) {
    throw new InvalidPdfTemplateError(
      `Nombre de pages hors bornes (${pageCount}), maximum ${DOCUMENT_PDF_TEMPLATE_MAX_PAGES}.`,
    );
  }

  const pages: DocumentPdfTemplatePageDto[] = document.getPages().map((page, index) => {
    const { width, height } = page.getSize();
    return {
      index,
      width_pt: round2(width),
      height_pt: round2(height),
    };
  });

  return { pageCount, pages };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
