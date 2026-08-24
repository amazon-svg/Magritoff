import { describe, expect, it } from 'vitest';
import { commercialManagementError } from '../../../src/app/hooks/useCommercialManagement';

describe('useCommercialManagement helpers', () => {
  it('conserve le message métier et fournit un fallback stable', () => {
    expect(commercialManagementError(new Error('Règle invalide'))).toBe('Règle invalide');
    expect(commercialManagementError(null)).toBe('Opération commerciale impossible.');
    expect(commercialManagementError(undefined, 'Chargement impossible.')).toBe('Chargement impossible.');
  });
});
