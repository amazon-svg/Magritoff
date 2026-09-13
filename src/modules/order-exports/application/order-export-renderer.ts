/**
 * Port `OrderExportRenderer` (story E10.18c, contrat §8.24 point 6) — UN SEUL
 * port derriere lequel vivent les DEUX renderers (CSV ici, XLSX en E10.18d).
 * C est ce qui rend le choix de bibliotheque XLSX tardif et reversible :
 * aucun code hors `renderers/xlsx.ts` ne connaitra jamais la bibliotheque.
 *
 * Le generateur NE DOIT JAMAIS `throw` (meme discipline que les adaptateurs
 * de canal du §8.23 §6) : il rend un VERDICT, et c est l appelant (le
 * runner) qui decide du statut final de l export. Le renderer est PUR
 * (aucune I/O) : il prend un TABLEAU de lignes DEJA lues (le plafond de
 * 50 000 est verifie AVANT cet appel, jamais ici) et rend des octets.
 */
import type { OrderExportGranularity } from '../api/contracts.ts';
import type { OrderExportRawRow } from './order-export-columns.ts';

export type OrderExportRenderInput = Readonly<{
  granularity: OrderExportGranularity;
  /** Lignes DEJA lues et bornees (<= 50 000) — jamais un flux, jamais un lecteur. */
  rows: readonly OrderExportRawRow[];
}>;

export type OrderExportRenderResult =
  | Readonly<{ ok: true; bytes: Uint8Array }>
  | Readonly<{ ok: false; code: string; detail: string }>;

export interface OrderExportRenderer {
  readonly format: 'csv' | 'xlsx';
  readonly contentType: string;
  readonly fileExtension: string;
  render(input: OrderExportRenderInput): Promise<OrderExportRenderResult>;
}
