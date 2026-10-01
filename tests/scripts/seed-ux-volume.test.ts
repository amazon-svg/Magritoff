import { describe, expect, it } from 'vitest';
import { uxVolumeSeedConfiguration } from '../../scripts/db/seed-ux-volume.mjs';

describe('seed UX volumique PostgreSQL', () => {
  it('conserve les volumes historiques et ajoute les devis', () => {
    expect(uxVolumeSeedConfiguration([])).toEqual({
      allTenants: true,
      tenantSlug: null,
      customerCount: 100,
      orderCount: 200,
      quoteCount: 150,
    });
  });

  it('accepte un tenant et des volumes explicites', () => {
    expect(uxVolumeSeedConfiguration(['atelier-test', '12', '23', '34'])).toEqual({
      allTenants: false,
      tenantSlug: 'atelier-test',
      customerCount: 12,
      orderCount: 23,
      quoteCount: 34,
    });
    expect(uxVolumeSeedConfiguration(['--all', '10', '20', '30'])).toMatchObject({
      allTenants: true,
      customerCount: 10,
      orderCount: 20,
      quoteCount: 30,
    });
  });

  it('refuse les slugs et volumes dangereux', () => {
    expect(() => uxVolumeSeedConfiguration(['../production'])).toThrow(/Slug/);
    expect(() => uxVolumeSeedConfiguration(['test', '0'])).toThrow(/clients/);
    expect(() => uxVolumeSeedConfiguration(['test', '10', '10001'])).toThrow(/commandes/);
    expect(() => uxVolumeSeedConfiguration(['test', '10', '20', 'beaucoup'])).toThrow(/devis/);
  });
});
