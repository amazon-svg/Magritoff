/**
 * Tests vitest pour PortalThankYou helpers (Story S-CONSO-3, Sprint 4 Phase 2).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { formatShortOrderId } from '@/modules/orders/ui/storefront/PortalThankYou';

const source = readFileSync(
  resolve(process.cwd(), 'src/modules/orders/ui/storefront/PortalThankYou.tsx'),
  'utf8',
);

describe('PortalThankYou — libellé de remerciement (BCP-5)', () => {
  // BCP-5 (docs/api/CONVENTIONS.md §8.25 point 5.1) : le statut draft reste
  // conforme au PRD (FR18/FR49) - seul l'écran ne doit plus dire "confirmée",
  // puisque seul l'imprimeur (admin du tenant) valide la commande.
  it('annonce la transmission à l imprimeur, pas une confirmation', () => {
    expect(source).toContain("Commande transmise — en attente de validation par l'imprimeur");
    expect(source).not.toContain('Commande confirmée');
  });

  // Écart remonté puis tranché par Arnaud : "Vous recevrez un email de
  // confirmation" est FAUX partout où la phrase apparaît, pas seulement
  // dans le panier (send-order-notification n'écrit qu'aux administrateurs
  // du tenant). Supprimée ici aussi, pas reformulée.
  it('ne promet plus un email de confirmation à l acheteur', () => {
    expect(source).not.toContain('email de confirmation');
    expect(source).not.toContain('sera envoyé prochainement');
  });
});

describe('formatShortOrderId', () => {
  it('UUID standard -> 8 premiers chars uppercase', () => {
    expect(formatShortOrderId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('A1B2C3D4');
  });

  it('UUID avec lettres mixed case -> normalise uppercase', () => {
    expect(formatShortOrderId('aBcDeF12-3456-7890-abcd-ef1234567890')).toBe('ABCDEF12');
  });

  it('string vide -> "—"', () => {
    expect(formatShortOrderId('')).toBe('—');
  });

  it('null -> "—"', () => {
    // @ts-expect-error test null safety
    expect(formatShortOrderId(null)).toBe('—');
  });

  it('undefined -> "—"', () => {
    // @ts-expect-error test undefined safety
    expect(formatShortOrderId(undefined)).toBe('—');
  });

  it('non-string -> "—"', () => {
    // @ts-expect-error test type safety
    expect(formatShortOrderId(12345)).toBe('—');
  });

  it('UUID court (<8 chars) -> retourne tout uppercase', () => {
    expect(formatShortOrderId('abc')).toBe('ABC');
  });
});
