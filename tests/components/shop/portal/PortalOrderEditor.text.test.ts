/**
 * BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1, Q1 2026-09-15) : l'atelier
 * voit le même libellé que l'acheteur pour le statut draft.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/modules/orders/ui/storefront/PortalOrderEditor.tsx'),
  'utf8',
);

describe('PortalOrderEditor — libellé atelier (BCP-5)', () => {
  it('ne nomme plus le statut "brouillon" côté atelier', () => {
    expect(source).toContain("Modifiable tant qu'elle est en attente de validation.");
    expect(source).not.toContain('en brouillon');
  });
});
