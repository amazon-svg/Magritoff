/**
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1, Q1 2026-09-15) : l'atelier
 * voit le même libellé que l'acheteur pour le statut draft.
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
    expect(source).toContain('La commande passera de <strong>En attente de validation</strong>');
    expect(source).not.toContain('<strong>Brouillon</strong>');
  });
});
