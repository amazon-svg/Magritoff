import { describe, expect, it } from 'vitest';
import { toTenantSlug } from '@/modules/tenants/ui/hooks/useSubTenantManagement';

describe('toTenantSlug', () => {
  it('normalise un nom de sous-espace en identifiant URL stable', () => {
    expect(toTenantSlug('  Équipe Île-de-France / B2B  ')).toBe('equipe-ile-de-france-b2b');
  });

  it('élimine les séparateurs aux extrémités', () => {
    expect(toTenantSlug('--- Magrit & Associés ---')).toBe('magrit-associes');
  });
});
