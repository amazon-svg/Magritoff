/**
 * Moteur de generation du PDF de devis (story E10.10b-4c, contrat
 * docs/api/CONVENTIONS.md §8.18 §5).
 *
 * FONCTION PURE au sens du contrat (aucun acces reseau, aucun acces base,
 * AUCUNE HORLOGE LUE — `renderQuoteDocument` ne prend que des octets et des
 * valeurs deja resolues, `issuedAt` etant deja passe en amont par
 * `document-field-value-resolver.ts`). C est le defaut exact reproche a
 * `renderQuoteHtml()` par le constat (e) de §8.13septies, a ne pas
 * reconduire.
 *
 * `pdf-lib`, PAS AcroForm (contrat §8.18 §1(b)) : chaque valeur est ecrite
 * par `PDFPage.drawText()` a une coordonnee absolue, jamais par remplissage
 * de champ de formulaire nomme.
 *
 * LA LOGIQUE DE MISE EN PAGE (routage des champs par famille, insertion des
 * pages de continuation, repli/troncature du texte) VIT DANS
 * `document-layout-planner.ts`, fonction PURE decouplee de `pdf-lib` — ce
 * fichier-ci ne fait plus que : (1) charger le fond, (2) embarquer les
 * polices necessaires pour fournir une MESURE reelle au planificateur,
 * (3) executer le plan qu il rend (copier/inserer les pages, dessiner les
 * blocs de texte). Separation deliberee pour la TESTABILITE : le
 * planificateur se teste sans ouvrir le moindre fichier PDF.
 *
 * Polices — STANDARD PDF SEULEMENT, sans repli police libre embarquee : la
 * preuve d execution de 4a (docs/api/CONVENTIONS.md §8.18 §0, mesure 4,
 * reprise par `pdf-template-inspector.ts`) a deja constate que
 * `StandardFonts.Helvetica` rend correctement les accents francais et « € »
 * — la reserve (e) ne s applique donc pas a ce moteur, `DocumentFont`
 * demeurant neanmoins une enumeration de ROLES (le moteur pourrait un jour
 * lier un role a une police libre sans que le contrat ni les cartes deja
 * enregistrees ne changent).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from 'pdf-lib';
import type { DocumentFont, DocumentPdfTemplatePageDto } from '../../document-templates/api/contracts.ts';
import type { DocumentFieldValues, DocumentLineFieldValues } from './document-field-value-resolver.ts';
import {
  planQuoteDocumentLayout,
  WRAPPED_LINE_STEP_FACTOR,
  type PlanQuoteDocumentLayoutInput,
} from './document-layout-planner.ts';
import type { DocumentFieldPlacementDto, DocumentLinesBlockDto } from '../../document-templates/api/contracts.ts';
import { sanitizeFieldValues } from './document-text-sanitization.ts';

/** Echec de rendu (fond illisible, geometrie incoherente...) — traduit en 500 `quote.document_generation_failed` par le service appelant. */
export class QuoteDocumentRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteDocumentRenderError';
  }
}

export type RenderQuoteDocumentInput = Readonly<{
  backgroundBytes: Uint8Array;
  /** Geometrie SERVEUR relue a l import (`DocumentPdfTemplateDetail.pages`) — verifiee CONTRE le fond reellement fourni, defense en profondeur. */
  pages: readonly DocumentPdfTemplatePageDto[];
  placements: readonly DocumentFieldPlacementDto[];
  linesBlock: DocumentLinesBlockDto | null;
  fieldValues: DocumentFieldValues;
  lineValues: readonly DocumentLineFieldValues[];
}>;

export type RenderedQuoteDocument = Readonly<{ bytes: Uint8Array; pageCount: number }>;

const STANDARD_FONT_BY_ROLE: Readonly<Record<DocumentFont, StandardFonts>> = {
  helvetica: StandardFonts.Helvetica,
  'helvetica-bold': StandardFonts.HelveticaBold,
  'helvetica-oblique': StandardFonts.HelveticaOblique,
  'times-roman': StandardFonts.TimesRoman,
  'times-bold': StandardFonts.TimesRomanBold,
  'times-italic': StandardFonts.TimesRomanItalic,
  courier: StandardFonts.Courier,
  'courier-bold': StandardFonts.CourierBold,
};

export async function renderQuoteDocument(input: RenderQuoteDocumentInput): Promise<RenderedQuoteDocument> {
  let templateDoc: PDFDocument;
  try {
    templateDoc = await PDFDocument.load(input.backgroundBytes);
  } catch (cause) {
    throw new QuoteDocumentRenderError(`Fond du gabarit illisible : ${messageOf(cause)}`);
  }

  const sourcePageCount = templateDoc.getPageCount();
  if (sourcePageCount !== input.pages.length) {
    // Defense en profondeur : ne devrait jamais se produire (une confirmation
    // d upload relit systematiquement la geometrie du fichier accepte), mais
    // un fond incoherent avec sa geometrie enregistree produirait des
    // placements decales sans que rien ne le signale — mieux vaut un echec
    // explicite (500 `quote.document_generation_failed`) qu un document faux.
    throw new QuoteDocumentRenderError(
      `Geometrie incoherente : le fond porte ${sourcePageCount} page(s), la carte en attend ${input.pages.length}.`,
    );
  }

  let outDoc: PDFDocument;
  try {
    outDoc = await PDFDocument.create();
  } catch (cause) {
    throw new QuoteDocumentRenderError(`Creation du document de sortie impossible : ${messageOf(cause)}`);
  }

  // Toutes les polices ROLES effectivement referencees par la carte,
  // embarquees UNE FOIS chacune, AVANT la planification : le planificateur a
  // besoin d une MESURE reelle (`widthOfTextAtSize`) pour replier/tronquer le
  // texte, mais reste lui-meme decouple de `pdf-lib` (voir en-tete).
  const referencedRoles = new Set<DocumentFont>();
  for (const placement of input.placements) referencedRoles.add(placement.font);
  if (input.linesBlock) for (const column of input.linesBlock.columns) referencedRoles.add(column.font);

  const fontByRole = new Map<DocumentFont, PDFFont>();
  try {
    for (const role of referencedRoles) {
      fontByRole.set(role, await outDoc.embedFont(STANDARD_FONT_BY_ROLE[role]));
    }
  } catch (cause) {
    throw new QuoteDocumentRenderError(`Embarquement d une police standard impossible : ${messageOf(cause)}`);
  }

  // qa-review B5 — FILET DE SECURITE (defense en profondeur), le resolveur
  // (`document-field-value-resolver.ts`) assainit deja les valeurs qu il
  // produit ; ce second passage protege un futur appelant du moteur qui ne
  // passerait pas par lui. Fait AVANT la planification (pas seulement avant
  // `drawText`) : la mesure de largeur (`widthOfTextAtSize`) qui pilote le
  // repli/troncature doit porter sur le texte REELLEMENT dessine, jamais sur
  // une version pre-assainissement dont la largeur differerait.
  const sanitizedFieldValues = sanitizeFieldValues(input.fieldValues as Record<string, string>);
  const sanitizedLineValues = input.lineValues.map((line) => sanitizeFieldValues(line as Record<string, string>));

  const planInput: PlanQuoteDocumentLayoutInput = {
    pages: input.pages,
    placements: input.placements,
    linesBlock: input.linesBlock,
    fieldValues: sanitizedFieldValues as DocumentFieldValues,
    lineValues: sanitizedLineValues as DocumentLineFieldValues[],
  };
  let plan;
  try {
    plan = planQuoteDocumentLayout(planInput, (font, size, text) => {
      const pdfFont = fontByRole.get(font);
      if (!pdfFont) throw new Error(`Police ${font} non embarquee (incoherence interne).`);
      return pdfFont.widthOfTextAtSize(text, size);
    });
  } catch (cause) {
    throw new QuoteDocumentRenderError(`Planification de la mise en page impossible : ${messageOf(cause)}`);
  }

  try {
    const copiedPages = await outDoc.copyPages(templateDoc, plan.outputPageSources as number[]);
    copiedPages.forEach((page) => outDoc.addPage(page));
  } catch (cause) {
    throw new QuoteDocumentRenderError(`Recopie du fond impossible : ${messageOf(cause)}`);
  }

  for (const block of plan.textBlocks) {
    const page = outDoc.getPage(block.outputPageIndex);
    const font = fontByRole.get(block.font);
    if (!font) throw new QuoteDocumentRenderError(`Police ${block.font} non embarquee (incoherence interne).`);
    const color = hexToRgb(block.color);
    const step = block.fontSize * WRAPPED_LINE_STEP_FACTOR;

    block.lines.forEach((line, index) => {
      const lineWidth = font.widthOfTextAtSize(line, block.fontSize);
      let x = block.x;
      if (block.width !== null && block.align === 'center') x = block.x + (block.width - lineWidth) / 2;
      else if (block.width !== null && block.align === 'right') x = block.x + (block.width - lineWidth);
      page.drawText(line, {
        x,
        y: block.y - index * step,
        size: block.fontSize,
        font,
        color,
      });
    });
  }

  let bytes: Uint8Array;
  try {
    bytes = await outDoc.save();
  } catch (cause) {
    throw new QuoteDocumentRenderError(`Enregistrement du PDF impossible : ${messageOf(cause)}`);
  }
  return { bytes, pageCount: plan.totalOutputPages };
}

function hexToRgb(hex: string): RGB {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
