/**
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1, Q1 2026-09-15) : l'atelier
 * voit le même libellé que l'acheteur pour le statut draft.
 *
 * qa-review de BCP-5 (2026-09-15), point 5.1(c) : « les messages d'erreur
 * qui nomment un statut le tirent eux aussi de la table ». Le texte ne
 * recopie donc plus les libellés à la main — il appelle `getStatusInfo(...)`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/modules/orders/ui/storefront/ValidateOrderConfirmDialog.tsx'),
  'utf8',
);

describe('ValidateOrderConfirmDialog — libellé atelier (BCP-5)', () => {
  it('ne nomme plus le statut Brouillon côté atelier', () => {
    expect(source).not.toContain('Brouillon');
  });

  it('tire les deux libellés de la table unique, jamais recopiés en dur', () => {
    expect(source).toContain("La commande passera de <strong>{getStatusInfo('draft').label}</strong>");
    expect(source).toContain("<strong>{getStatusInfo('validated').label}</strong>");
    expect(source).not.toContain('<strong>En attente de validation</strong>');
    expect(source).not.toContain('<strong>Validée</strong>');
  });
});
