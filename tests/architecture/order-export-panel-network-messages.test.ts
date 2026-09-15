/**
 * DEFAUT R3, qa-review round 4 (2026-09-15) — deux points de
 * `OrderExportPanel.tsx` (le chargement initial du registre et le
 * rafraichissement de l URL au clic sur « Telecharger ») affichaient encore
 * `cause.message` TEL QUEL, donc le texte ANGLAIS brut d une panne reseau
 * (« Failed to fetch »). La decision a ete extraite en deux fonctions pures
 * NOMMEES (`resolveOrderExportListLoadErrorMessage`/`resolveOrderExport
 * DownloadRefreshErrorMessage`, `order-export.helpers.ts`), deja testees
 * directement (`tests/modules/commercial-orders/order-export.helpers.test.ts`).
 *
 * Ce depot n a AUCUN outil de rendu React (constat repete dans tout le
 * module `commercial-orders/ui/`) : la SEULE preuve possible que le
 * composant appelle bien ces fonctions — plutot que de continuer a decider
 * lui-meme — est une lecture du SOURCE, exactement le patron deja etabli
 * par `radix-ref-forwarding.test.ts`/`order-export-xlsx-library-
 * boundaries.test.ts`. Ce test echoue sur le code D AVANT ce correctif :
 * le motif brut `cause instanceof Error ? cause.message` y apparaissait
 * DEUX fois, et aucune des deux fonctions n etait importee.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('OrderExportPanel.tsx — DEFAUT R3, qa-review round 4 : plus aucun `cause.message` brut', () => {
  const panel = source('src/modules/commercial-orders/ui/components/OrderExportPanel.tsx');

  it('importe les deux fonctions dediees depuis order-export.helpers', () => {
    expect(panel).toContain('resolveOrderExportListLoadErrorMessage');
    expect(panel).toContain('resolveOrderExportDownloadRefreshErrorMessage');
  });

  it('n affiche plus JAMAIS le motif brut `cause instanceof Error ? cause.message`', () => {
    // AVANT ce correctif : ce motif apparaissait DEUX FOIS (chargement du
    // registre au montage, rafraichissement de l URL au clic).
    expect(panel).not.toMatch(/cause instanceof Error \? cause\.message/);
  });

  it('appelle bien `resolveOrderExportListLoadErrorMessage(cause)` dans le `dispatch` de `listLoadFailed`', () => {
    expect(panel).toMatch(/message:\s*resolveOrderExportListLoadErrorMessage\(cause\)/);
  });

  it('appelle bien `resolveOrderExportDownloadRefreshErrorMessage(cause)` dans `setDownloadErrorsById`', () => {
    expect(panel).toMatch(/\[exportId\]:\s*resolveOrderExportDownloadRefreshErrorMessage\(cause\)/);
  });
});
