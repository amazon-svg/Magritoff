/**
 * Onglet "Tableau" (wireframe ecran C) : une SEULE zone de colonnes qui se
 * repete — jamais de positionnement ligne par ligne (garantie structurelle
 * du contrat). `rows_per_page` est plafonne cote client par
 * `maxRowsPerPage()` (meme fonction que la validation serveur) pour rendre
 * l erreur 422 "rows_per_page incompatible" pratiquement inatteignable
 * depuis cet ecran (wireframe §3, note 8).
 *
 * Le RENDU VISUEL du tableau (ligne reelle + ligne fictive grisee sur le
 * canvas) est porte par `DocumentTemplateFieldsPage.tsx` (qui a acces a la
 * conversion point-PDF <-> pixel et au fond PDF.js) ; ce panneau ne porte que
 * les CONTROLES de reglage (ancre, espacement, colonnes).
 *
 * ECART SIGNALE : l ancre et l espacement restent aussi reglables par ces
 * CONTROLES NUMERIQUES explicites (page/x-y d ancre, espacement), en plus du
 * glisse sur le canvas — memes donnees, memes contraintes, deux chemins pour
 * y arriver.
 */
import { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TEST_IDS } from '@/shared/presentation/testIds';
import type {
  DocumentLineFieldId,
  DocumentLinesBlockDto,
  DocumentLinesColumnDto,
  DocumentPdfTemplatePageDto,
} from '@/modules/document-templates/api/contracts';
import { LINE_FIELD_CATALOG, lineFieldLabel } from './field-catalog';
import { maxRowsPerPage } from './pdf-coordinates';

export type LinesTablePanelProps = Readonly<{
  pages: readonly DocumentPdfTemplatePageDto[];
  currentPageIndex: number;
  linesBlock: DocumentLinesBlockDto | null;
  onCreate(): void;
  onChange(next: DocumentLinesBlockDto): void;
  onRemove(): void;
}>;

function defaultColumn(field: DocumentLineFieldId, x: number): DocumentLinesColumnDto {
  return { field, x, width: 80, align: 'left', font: 'helvetica', font_size: 10, color: '#111111' };
}

export function LinesTablePanel({ pages, currentPageIndex, linesBlock, onCreate, onChange, onRemove }: LinesTablePanelProps) {
  const cap = linesBlock ? maxRowsPerPage(linesBlock.first_row_baseline_y, linesBlock.row_height) : 1;

  // qa-review R1 : plafonne l ETAT stocke, pas seulement la VALEUR affichee.
  // Sans cet effet, remonter l ancre (ou resserrer l espacement) apres avoir
  // regle 20 lignes faisait chuter `cap` sans jamais corriger
  // `rows_per_page` en memoire : l ecran affichait une valeur plafonnee
  // (`Math.min` sur la vue) pendant que l etat reellement envoye au serveur
  // restait invalide, provoquant un 422 a l enregistrement alors que l ecran
  // semblait correct. Les hooks doivent s executer inconditionnellement :
  // cet effet est declare AVANT tout retour anticipe (etat vide).
  useEffect(() => {
    if (linesBlock && linesBlock.rows_per_page > cap) {
      onChange({ ...linesBlock, rows_per_page: cap });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap, linesBlock?.rows_per_page]);

  if (!linesBlock) {
    return (
      <div className="space-y-3 text-center py-6">
        <p className="text-sm text-ink-muted">
          Aucun tableau de lignes sur ce gabarit.
          <br />
          Si ce document n’a pas besoin de détailler des lignes de produit (accusé de réception, page de garde),
          vous pouvez laisser cet onglet vide.
        </p>
        <button
          type="button"
          onClick={onCreate}
          data-testid={TEST_IDS.documentTemplateFields.insertTableBtn}
          className="px-4 py-2 bg-brand text-brand-ink rounded-lg text-sm font-medium inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Insérer le tableau des lignes
        </button>
      </div>
    );
  }

  const page = pages[linesBlock.page_index];
  const usedFields = new Set(linesBlock.columns.map((column) => column.field));
  const availableFields = LINE_FIELD_CATALOG.filter((entry) => !usedFields.has(entry.id));
  const displayedRowsPerPage = Math.min(linesBlock.rows_per_page, cap);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-ink">Tableau des lignes</h3>

      {pages.length > 1 && (
        <div className="space-y-1">
          <label htmlFor="lines-table-page" className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
            Page du tableau
          </label>
          <select
            id="lines-table-page"
            value={linesBlock.page_index}
            className="w-full px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm"
            onChange={(event) => onChange({ ...linesBlock, page_index: Number(event.target.value) })}
          >
            {pages.map((candidate) => (
              <option key={candidate.index} value={candidate.index}>
                Page {candidate.index + 1}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <span id="lines-table-anchor-label" className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
          Ancre (première ligne)
        </span>
        <div className="flex items-center gap-2 text-sm" role="group" aria-labelledby="lines-table-anchor-label">
          <label htmlFor="lines-table-anchor-x" className="text-ink-muted">
            x
          </label>
          <input
            id="lines-table-anchor-x"
            type="number"
            value={linesBlock.columns[0]?.x ?? 0}
            className="w-20 px-2 py-1.5 border border-line-2 rounded-lg bg-paper"
            onChange={(event) => {
              const delta = Number(event.target.value) - (linesBlock.columns[0]?.x ?? 0);
              onChange({ ...linesBlock, columns: linesBlock.columns.map((column) => ({ ...column, x: column.x + delta })) });
            }}
          />
          <label htmlFor="lines-table-anchor-y" className="text-ink-muted">
            y
          </label>
          <input
            id="lines-table-anchor-y"
            type="number"
            value={linesBlock.first_row_baseline_y}
            className="w-20 px-2 py-1.5 border border-line-2 rounded-lg bg-paper"
            onChange={(event) => onChange({ ...linesBlock, first_row_baseline_y: Number(event.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="lines-table-row-height" className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
          Se répète toutes les — pt
        </label>
        <input
          id="lines-table-row-height"
          type="number"
          min={4}
          max={200}
          value={linesBlock.row_height}
          data-testid={TEST_IDS.documentTemplateFields.rowHeightInput}
          onChange={(event) => onChange({ ...linesBlock, row_height: Number(event.target.value) })}
          className="w-24 px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm"
        />
        <p className="text-xs text-ink-muted" title="Cette ligne grisée est un repère : elle montre où s’écrira la 2ᵉ ligne du devis, pas une donnée réelle.">
          La 2ᵉ ligne du devis s’écrirait {linesBlock.row_height} pt plus bas (repère, pas une donnée réelle).
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="lines-table-rows-per-page" className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
          Lignes par page
        </label>
        <input
          id="lines-table-rows-per-page"
          type="number"
          min={1}
          max={cap}
          value={displayedRowsPerPage}
          data-testid={TEST_IDS.documentTemplateFields.rowsPerPageInput}
          onChange={(event) => onChange({ ...linesBlock, rows_per_page: Math.min(Number(event.target.value), cap) })}
          className="w-24 px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm"
        />
        <p className="text-xs text-ink-muted">
          {displayedRowsPerPage >= cap
            ? `Maximum atteint pour cet emplacement : ${cap} lignes tiennent entre le début du tableau et le bas de la page. Rapprochez les lignes pour en afficher davantage.`
            : `Au-delà, Magrit imprime une page supplémentaire en recopiant votre gabarit et continue d’y écrire des lignes. Maximum sur cette page : ${cap}.`}
        </p>
      </div>

      {pages.length > 1 && (
        <div className="space-y-1">
          <label htmlFor="lines-table-continuation-page" className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
            Page de reprise
          </label>
          <select
            id="lines-table-continuation-page"
            value={linesBlock.continuation_page_index ?? ''}
            data-testid={TEST_IDS.documentTemplateFields.continuationPageSelect}
            className="w-full px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm"
            onChange={(event) =>
              onChange({
                ...linesBlock,
                continuation_page_index: event.target.value === '' ? null : Number(event.target.value),
              })
            }
          >
            <option value="">Cette page ({linesBlock.page_index + 1})</option>
            {pages
              .filter((candidate) => candidate.index !== linesBlock.page_index)
              .map((candidate) => (
                <option key={candidate.index} value={candidate.index}>
                  Page {candidate.index + 1}
                </option>
              ))}
          </select>
          <p className="text-xs text-ink-muted">
            Si le devis a plus de lignes que ce gabarit n’en prévoit, Magrit ajoute une page en recopiant celle que
            vous choisissez ici.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <span id="lines-table-columns-label" className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
          Colonnes ({linesBlock.columns.length}/7)
        </span>
        {linesBlock.columns.map((column, index) => (
          <div
            key={`${column.field}-${index}`}
            data-testid={TEST_IDS.documentTemplateFields.columnRow}
            className="flex items-center gap-1.5 border border-line-2 rounded-lg p-1.5"
          >
            <span className="text-xs text-ink-2 flex-1 truncate">
              {index + 1}. {lineFieldLabel(column.field)}
            </span>
            <label htmlFor={`lines-table-column-x-${index}`} className="text-xs text-ink-muted">
              x
            </label>
            <input
              id={`lines-table-column-x-${index}`}
              type="number"
              value={column.x}
              className="w-16 px-1 py-1 border border-line-2 rounded bg-paper text-xs"
              onChange={(event) => {
                const nextColumns = [...linesBlock.columns];
                nextColumns[index] = { ...column, x: Number(event.target.value) };
                onChange({ ...linesBlock, columns: nextColumns });
              }}
            />
            <label htmlFor={`lines-table-column-width-${index}`} className="text-xs text-ink-muted">
              l.
            </label>
            <input
              id={`lines-table-column-width-${index}`}
              type="number"
              value={column.width}
              className="w-16 px-1 py-1 border border-line-2 rounded bg-paper text-xs"
              onChange={(event) => {
                const nextColumns = [...linesBlock.columns];
                nextColumns[index] = { ...column, width: Number(event.target.value) };
                onChange({ ...linesBlock, columns: nextColumns });
              }}
            />
            <select
              aria-label={`Alignement de la colonne ${lineFieldLabel(column.field)}`}
              value={column.align}
              className="px-1 py-1 border border-line-2 rounded bg-paper text-xs"
              onChange={(event) => {
                const nextColumns = [...linesBlock.columns];
                nextColumns[index] = { ...column, align: event.target.value as DocumentLinesColumnDto['align'] };
                onChange({ ...linesBlock, columns: nextColumns });
              }}
            >
              <option value="left">Gauche</option>
              <option value="center">Centré</option>
              <option value="right">Droite</option>
            </select>
            <button
              type="button"
              aria-label="Retirer la colonne"
              data-testid={TEST_IDS.documentTemplateFields.removeColumnBtn}
              onClick={() => onChange({ ...linesBlock, columns: linesBlock.columns.filter((_, i) => i !== index) })}
              className="p-1 text-ink-muted hover:text-err-fg"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {linesBlock.columns.length < 7 && (
          <select
            value=""
            aria-labelledby="lines-table-columns-label"
            data-testid={TEST_IDS.documentTemplateFields.addColumnSelect}
            className="w-full px-2 py-1.5 border border-line-2 rounded-lg bg-paper text-sm"
            onChange={(event) => {
              const field = event.target.value as DocumentLineFieldId;
              if (!field) return;
              const nextX = (linesBlock.columns.at(-1)?.x ?? 40) + (linesBlock.columns.at(-1)?.width ?? 80) + 10;
              onChange({ ...linesBlock, columns: [...linesBlock.columns, defaultColumn(field, nextX)] });
            }}
          >
            <option value="">+ Ajouter une colonne</option>
            {availableFields.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        )}
        {linesBlock.columns.length === 0 && (
          <p className="text-xs text-err-fg">
            Le tableau des lignes doit avoir au moins une colonne avant d’être enregistré. Ajoutez-en une, ou
            supprimez le tableau si ce document n’en a pas besoin.
          </p>
        )}
      </div>

      {!page && (
        <p className="text-xs text-err-fg">La page {linesBlock.page_index + 1} n’existe pas dans ce gabarit.</p>
      )}

      <button
        type="button"
        onClick={onRemove}
        data-testid={TEST_IDS.documentTemplateFields.removeTableBtn}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-err-fg border border-err-fg/40 rounded-lg hover:bg-err-bg"
      >
        <Trash2 className="w-4 h-4" />
        Supprimer le tableau
      </button>

      <p className="text-xs text-ink-muted">Page actuellement affichée : {currentPageIndex + 1}.</p>
    </div>
  );
}
