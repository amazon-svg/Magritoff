import { describe, expect, it } from 'vitest';
import { pimAutomationError } from '../../../src/app/hooks/usePimAutomation';

describe('pimAutomationError', () => {
  it('conserve le message métier du contrat API', () => {
    expect(pimAutomationError(new Error('File PIM indisponible.'), 'Échec.'))
      .toBe('File PIM indisponible.');
  });

  it('utilise un message contrôlé pour une erreur inconnue', () => {
    expect(pimAutomationError({ status: 503 }, 'Échec contrôlé.'))
      .toBe('Échec contrôlé.');
  });
});
