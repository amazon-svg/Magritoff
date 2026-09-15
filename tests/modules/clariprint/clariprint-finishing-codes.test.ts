import { describe, expect, it } from 'vitest';
import {
  formatClariprintFinishingLabel,
  getClariprintFinishingLabel,
} from '@/modules/clariprint/application/clariprint-finishing-codes';

describe('getClariprintFinishingLabel', () => {
  it('rend le libelle acheteur pour les cinq codes connus (docs/api/CONVENTIONS.md §8.25 point 5.3)', () => {
    expect(getClariprintFinishingLabel('PELLIC_ACETATE_BRILLANT')).toBe('Pelliculage brillant');
    expect(getClariprintFinishingLabel('PELLIC_ACETATE_MAT')).toBe('Pelliculage mat');
    expect(getClariprintFinishingLabel('OFFSET_SATIN')).toBe('Vernis satiné');
    expect(getClariprintFinishingLabel('UVS_MAT_RESERVE')).toBe('Vernis sélectif mat');
  });

  it('masque la chaine vide (aucune finition)', () => {
    expect(getClariprintFinishingLabel('')).toBeNull();
  });

  // point 5.3 : "Code inconnu → masqué, jamais affiché." Exemple donné par
  // le cadrage : PELLIC_BRILL (fixture historique de ProductOverlay.helpers.test.ts).
  it('masque un code inconnu, jamais ne l affiche brut', () => {
    expect(getClariprintFinishingLabel('PELLIC_BRILL')).toBeNull();
    expect(getClariprintFinishingLabel('CODE_JAMAIS_VU')).toBeNull();
  });
});

describe('formatClariprintFinishingLabel', () => {
  it('joint les libelles connus par " + " pour une combinaison', () => {
    expect(formatClariprintFinishingLabel(['PELLIC_ACETATE_BRILLANT', 'OFFSET_SATIN'])).toBe('Pelliculage brillant + Vernis satiné');
  });

  it('accepte un code seul (pas un tableau)', () => {
    expect(formatClariprintFinishingLabel('PELLIC_ACETATE_MAT')).toBe('Pelliculage mat');
  });

  it('masque toute la ligne si aucun code de la combinaison n est connu', () => {
    expect(formatClariprintFinishingLabel(['INCONNU_1', 'INCONNU_2'])).toBeNull();
  });

  it('ignore les codes inconnus dans une combinaison partiellement connue', () => {
    expect(formatClariprintFinishingLabel(['PELLIC_ACETATE_BRILLANT', 'INCONNU'])).toBe('Pelliculage brillant');
  });

  it('masque un tableau vide', () => {
    expect(formatClariprintFinishingLabel([])).toBeNull();
  });
});
