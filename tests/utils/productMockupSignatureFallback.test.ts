/**
 * S2.14 (FR-ECOM-04) — Garantie mockup-signature de famille.
 *
 * Le visuel produit sert d'identifiant de catégorie. Cette story est
 * majoritairement satisfaite par l'infra existante (productMockupAssets) : ce
 * test verrouille la garantie AC1 = "famille sans mockup dédié → fallback par
 * famille, jamais de card cassée", y compris pour les NOUVELLES gammes à venir
 * (affiches, banderoles, enveloppes, sacs, goodies) qui doivent router vers une
 * des 7 familles existantes tant qu'elles n'ont pas leur propre visuel.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveMockupTemplate,
  resolveProductMockupAsset,
} from '../../src/app/utils/productMockupAssets';

describe('S2.14 — mockup-signature : fallback garanti', () => {
  it('retourne toujours une URL non vide (jamais de card cassée)', () => {
    const inputs = [
      { config: { kind: 'flyer' } },
      { config: { kind: 'carte_visite' } },
      {}, // aucun kind, aucun nom → fallback flyer
      { name: 'Produit exotique sans famille connue' },
    ];
    for (const input of inputs) {
      const url = resolveProductMockupAsset(input);
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    }
  });

  it('route les nouvelles gammes (via synonymes) vers une famille valide', () => {
    // Nouvelles gammes du backlog visuel : doivent router vers une des 7
    // familles tant qu'elles n'ont pas leur propre mockup-signature.
    const routing: Array<[Record<string, unknown>, string]> = [
      [{ name: 'Affiche A2 événement' }, 'flyer'],
      [{ name: 'Banderole extérieure 3m' }, 'kakemono'],
      [{ config: { kind: 'sticker' } }, 'etiquette'],
    ];
    for (const [input, expectedFamily] of routing) {
      expect(resolveMockupTemplate(input)).toBe(expectedFamily);
      expect(resolveProductMockupAsset(input).length).toBeGreaterThan(0);
    }
  });
});
