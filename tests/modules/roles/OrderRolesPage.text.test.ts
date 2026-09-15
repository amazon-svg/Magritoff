/**
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1(c), arbitrage architecte
 * 2026-09-15, sur un constat du dev-story de BCP-5).
 *
 * `OrderRolesPage.tsx:578` codait en dur une phrase de 8 libellés de
 * statut : « Brouillon · En attente de validation · Validée · En
 * production · Expédiée · Livrée · Facturée · Annulée ». Le premier
 * ("Brouillon") était un vestige du `pending_validation` de maquette que
 * S-ORDER-ROLES n'a jamais créé — un HUITIÈME item fantôme pour SEPT
 * statuts réels.
 *
 * L'écran doit désormais lire la table UNIQUE via `getOrderStatusLegendLabels()`,
 * jamais recopier de libellé en dur.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/modules/roles/ui/workspace/OrderRolesPage.tsx'),
  'utf8',
);

describe('OrderRolesPage — liste des statuts tirée de la table unique (BCP-5)', () => {
  it('appelle getOrderStatusLegendLabels() plutôt que de recopier les libellés', () => {
    expect(source).toContain('getOrderStatusLegendLabels()');
  });

  it('ne contient plus le libellé fantôme "Brouillon" ni la phrase codée en dur', () => {
    expect(source).not.toContain('Brouillon · En attente de validation');
  });
});
