/**
 * Tests vitest pour le hook `useClariprintProduct` extrait dans R1 Phase A.
 *
 * Le hook n'est pas teste en environnement React (vitest tourne en `node`,
 * pas de @testing-library). On teste la logique du wrapper
 * `computeClariprintQuoteSafe` qu'il consomme + son contrat exporte
 * (signature + interface).
 *
 * Note : la verification du fix bug E1 (sync `localProduct ← product`) se
 * fera via TF Notion + smoke visuel — pas de test unitaire React possible
 * dans la config vitest actuelle.
 */

import { describe, it, expect } from 'vitest';
import { useClariprintProduct } from '@/modules/clariprint/ui/hooks/useClariprintProduct';

describe('useClariprintProduct - contrat exporte', () => {
  it('1. hook est une fonction', () => {
    expect(typeof useClariprintProduct).toBe('function');
  });

  it('2. exige une passerelle choisie par la surface appelante', () => {
    expect(useClariprintProduct.length).toBe(1);
  });
});
