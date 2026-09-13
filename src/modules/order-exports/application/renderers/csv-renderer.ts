/**
 * Renderer CSV de l export comptable des commandes (story E10.18c, contrat
 * §8.24 point 5 regle 2/3 — « forme du CSV, imposee et non negociable »).
 *
 * Pur (aucune I/O), synchrone au fond (enveloppe `Promise` uniquement pour
 * respecter le port `OrderExportRenderer`, partage avec le futur renderer
 * XLSX de E10.18d).
 *
 * ── Ce que ce renderer NE fait PAS ──────────────────────────────────────────
 * Il NE CONVERTIT AUCUN nombre. Une cellule `money`/`rate` arrive DEJA en
 * CHAINE decimale (contrat point 5 : « le CSV ne convertit rien du tout, il
 * recopie la chaine decimale en remplacant le point par la virgule ») — la
 * conversion `string -> number` (`toSpreadsheetNumber`) n existe QUE pour le
 * XLSX (E10.18d), qui a besoin d un nombre NATIF pour poser un format de
 * cellule. Melanger les deux ici referait de ce fichier un second point de
 * conversion, exactement ce que le contrat interdit.
 */
import { formatCivilDateInReferenceTimeZone, orderExportColumnsFor, type SpreadsheetCell } from '../order-export-columns.ts';
import type { OrderExportRenderer, OrderExportRenderInput, OrderExportRenderResult } from '../order-export-renderer.ts';

const COLUMN_SEPARATOR = ';';
const LINE_BREAK = '\r\n';
/** U+FEFF — encodage UTF-8 AVEC BOM (contrat, non negociable). */
const BOM = '﻿';
const NEEDS_QUOTING = /[;"\r\n]/;

/** Recopie une chaine decimale `"1234.50"` -> `"1234,50"`. AUCUNE arithmetique. */
function decimalToCsv(decimal: string | null): string {
  if (decimal === null) return '';
  return decimal.replace('.', ',');
}

function cellToCsv(cell: SpreadsheetCell): string {
  switch (cell.kind) {
    case 'text':
      return cell.value ?? '';
    case 'money':
    case 'rate':
      return decimalToCsv(cell.decimal);
    case 'integer':
      return String(cell.value);
    case 'date':
      return formatCivilDateInReferenceTimeZone(cell.instant);
    default: {
      const exhaustive: never = cell;
      throw new TypeError(`csv-renderer: type de cellule inconnu ${JSON.stringify(exhaustive)}.`);
    }
  }
}

/** Guillemets doubles avec DOUBLEMENT interne, uniquement si le champ porte `;`, `"`, `\r` ou `\n` (contrat, forme non negociable). */
function quoteField(field: string): string {
  if (!NEEDS_QUOTING.test(field)) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

export const csvOrderExportRenderer: OrderExportRenderer = Object.freeze({
  format: 'csv',
  contentType: 'text/csv',
  fileExtension: 'csv',
  async render(input: OrderExportRenderInput): Promise<OrderExportRenderResult> {
    try {
      const columns = orderExportColumnsFor(input.granularity);
      const lines: string[] = [columns.map((column) => quoteField(column.header)).join(COLUMN_SEPARATOR)];

      for (const row of input.rows) {
        const fields = columns.map((column) => quoteField(cellToCsv(column.cell(row))));
        lines.push(fields.join(COLUMN_SEPARATOR));
      }

      const text = BOM + lines.join(LINE_BREAK) + LINE_BREAK;
      return { ok: true, bytes: new TextEncoder().encode(text) };
    } catch (error) {
      return {
        ok: false,
        code: 'order_export.generation_failed',
        detail: error instanceof Error ? error.message : 'Erreur inattendue du renderer CSV.',
      };
    }
  },
});
