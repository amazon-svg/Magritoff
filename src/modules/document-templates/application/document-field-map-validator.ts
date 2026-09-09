/**
 * Validation SEMANTIQUE de la carte de correspondance d un gabarit PDF
 * (story E10.10b-4b, contrat `openapi/magrit-core.v1.yaml`,
 * `PUT /document-pdf-templates/{templateId}/fields`, 422
 * `document_pdf_template.invalid_field_map`).
 *
 * Fonction PURE : aucune dependance a Supabase, au HTTP, ni a une horloge.
 * Prend la geometrie SERVEUR du gabarit (`DocumentPdfTemplateDetail.pages`,
 * relue par le serveur dans le fichier accepte — jamais celle estimee par le
 * navigateur) et la carte proposee, rend la liste des erreurs de champ
 * (`Problem.errors`, vide si la carte est valide).
 *
 * Ce que le contrat REFUSE explicitement (§8.18 §4, description de
 * `replaceDocumentPdfTemplateFields`) :
 *  - une page qui n existe pas dans le fond ;
 *  - une coordonnee hors de la page declaree ;
 *  - un champ place deux fois ;
 *  - une colonne de lignes citant un champ deja utilise par une autre colonne ;
 *  - un bloc de lignes sans aucune colonne (deja tenu par le schema Zod,
 *    `minItems: 1` — revalide ici par souci de defense en profondeur) ;
 *  - un `rows_per_page` incompatible avec la hauteur de la page.
 *
 * Ce que ce fichier ajoute, au-dela de cette liste, en s appuyant sur une
 * regle EXPLICITEMENT posee par le contrat mais non reprise dans le
 * paragraphe de synthese de l operation (`DocumentTextAlign` : "right et
 * center EXIGENT que la place disponible soit connue") : un alignement
 * `center`/`right` sans `width` sur un PLACEMENT (les colonnes de lignes
 * portent toujours une largeur, par construction du schema). Signale
 * explicitement au rapport de fin de story plutot que passe sous silence.
 */
import type {
  DocumentPdfTemplatePageDto,
  ReplaceDocumentPdfTemplateFieldsCommand,
} from '../api/contracts.ts';

export type FieldMapValidationError = Readonly<{
  field: string;
  message: string;
}>;

export function validateDocumentFieldMap(
  pages: readonly DocumentPdfTemplatePageDto[],
  command: ReplaceDocumentPdfTemplateFieldsCommand,
): readonly FieldMapValidationError[] {
  const errors: FieldMapValidationError[] = [];
  const pageByIndex = new Map(pages.map((page) => [page.index, page]));

  const seenPlacementFields = new Set<string>();
  command.placements.forEach((placement, index) => {
    const prefix = `placements[${index}]`;

    if (seenPlacementFields.has(placement.field)) {
      errors.push({
        field: `${prefix}.field`,
        message: `Le champ ${placement.field} est déjà positionné ailleurs sur ce gabarit.`,
      });
    }
    seenPlacementFields.add(placement.field);

    const page = pageByIndex.get(placement.page_index);
    if (!page) {
      errors.push({
        field: `${prefix}.page_index`,
        message: `La page ${placement.page_index} n existe pas dans ce gabarit.`,
      });
    } else {
      if (placement.x > page.width_pt) {
        errors.push({
          field: `${prefix}.x`,
          message: `La coordonnée x (${placement.x}) dépasse la largeur de la page (${page.width_pt} pt).`,
        });
      }
      if (placement.y > page.height_pt) {
        errors.push({
          field: `${prefix}.y`,
          message: `La coordonnée y (${placement.y}) dépasse la hauteur de la page (${page.height_pt} pt).`,
        });
      }
    }

    const hasWidth = placement.width !== null && placement.width !== undefined;
    if ((placement.align === 'center' || placement.align === 'right') && !hasWidth) {
      errors.push({
        field: `${prefix}.align`,
        message: 'Un alignement centré ou à droite exige une largeur (tirez le bord droit de l’étiquette).',
      });
    }
  });

  const block = command.lines_block;
  if (block) {
    const page = pageByIndex.get(block.page_index);
    if (!page) {
      errors.push({
        field: 'lines_block.page_index',
        message: `La page ${block.page_index} n existe pas dans ce gabarit.`,
      });
    } else {
      if (block.first_row_baseline_y > page.height_pt) {
        errors.push({
          field: 'lines_block.first_row_baseline_y',
          message: `L ancre du tableau (${block.first_row_baseline_y} pt) dépasse la hauteur de la page (${page.height_pt} pt).`,
        });
      }
      // Contrat : "Refuse en 422 si first_row_baseline_y - (rows_per_page - 1)
      // * row_height sort de la page" — la ligne la plus basse ne doit jamais
      // descendre sous le bord du papier (0).
      const lowestBaseline = block.first_row_baseline_y - (block.rows_per_page - 1) * block.row_height;
      if (lowestBaseline < 0) {
        errors.push({
          field: 'lines_block.rows_per_page',
          message:
            'Le nombre de lignes par page fait déborder le tableau sous le bas de la page. Réduisez-le ou rapprochez les lignes.',
        });
      }
    }

    if (
      block.continuation_page_index !== null &&
      block.continuation_page_index !== undefined &&
      !pageByIndex.has(block.continuation_page_index)
    ) {
      errors.push({
        field: 'lines_block.continuation_page_index',
        message: `La page de reprise ${block.continuation_page_index} n existe pas dans ce gabarit.`,
      });
    }

    if (block.columns.length === 0) {
      errors.push({
        field: 'lines_block.columns',
        message: 'Le tableau des lignes doit avoir au moins une colonne.',
      });
    }

    const seenColumnFields = new Set<string>();
    block.columns.forEach((column, index) => {
      if (seenColumnFields.has(column.field)) {
        errors.push({
          field: `lines_block.columns[${index}].field`,
          message: `La colonne ${column.field} est déjà utilisée par une autre colonne.`,
        });
      }
      seenColumnFields.add(column.field);
    });
  }

  return errors;
}

/**
 * Plafond de `rows_per_page` compatible avec l espace REELLEMENT disponible
 * entre l ancre et le bas de la page (wireframe §2, écran C : "Maximum sur
 * cette page"). Reprend l inégalité du contrat (`DocumentLinesBlock.rows_per_page`) :
 * `first_row_baseline_y - (n - 1) * row_height >= 0`.
 */
export function maxRowsPerPage(firstRowBaselineY: number, rowHeight: number): number {
  if (rowHeight <= 0) return 1;
  return Math.max(1, Math.floor(firstRowBaselineY / rowHeight) + 1);
}

/**
 * Nombre de pages qu un devis de `totalLines` lignes ferait tenir avec ce
 * bloc de lignes (contrat, §8.18 §3 "Debordement") : au-dela de
 * `rows_per_page`, le moteur AJOUTE une page de continuation et continue d y
 * ecrire, autant de fois que necessaire.
 *
 * DEPLACEE ICI (E10.10b-4c) depuis
 * `ui/workspace/field-editor/pdf-coordinates.ts` (E10.10b-4b), qui la
 * RE-EXPORTE desormais depuis ce module plutot que de la definir en double —
 * MEME calcul reutilise par l apercu client (4b) et par le moteur de
 * generation serveur (`quote-document-renderer.ts`, 4c), pour ne jamais
 * laisser deux implementations diverger (consigne explicite du cadrage 4c).
 * Fonction PURE : aucune dependance a pdf-lib, a Supabase ni au DOM.
 */
export function computeDocumentPageCount(
  totalLines: number,
  linesBlock: Readonly<{ rows_per_page: number }> | null,
): number {
  if (!linesBlock || linesBlock.rows_per_page <= 0 || totalLines <= linesBlock.rows_per_page) return 1;
  return 1 + Math.ceil((totalLines - linesBlock.rows_per_page) / linesBlock.rows_per_page);
}
