import { describe, expect, it } from 'vitest';
import { buildResolvedTenantPath } from '@/modules/tenants/ui/hooks/useLegacyTenantSlugResolution';

describe('buildResolvedTenantPath', () => {
  it('remplace uniquement le segment tenant et conserve la route complète', () => {
    expect(buildResolvedTenantPath({
      oldSlug: 'ancien-atelier',
      resolvedSlug: 'nouvel-atelier',
      pathname: '/t/ancien-atelier/dashboard/users',
      search: '?filtre=actifs',
      hash: '#roles',
    })).toBe('/t/nouvel-atelier/dashboard/users?filtre=actifs#roles');
  });

  it('redirige la racine du tenant sans ajouter de séparateur', () => {
    expect(buildResolvedTenantPath({
      oldSlug: 'ancien',
      resolvedSlug: 'nouveau',
      pathname: '/t/ancien',
      search: '',
      hash: '',
    })).toBe('/t/nouveau');
  });

  it('retourne le fallback pour un slug absent, inconnu ou inchangé', () => {
    const base = { pathname: '/t/ancien', search: '', hash: '' };
    expect(buildResolvedTenantPath({ ...base, oldSlug: '', resolvedSlug: 'nouveau' })).toBeNull();
    expect(buildResolvedTenantPath({ ...base, oldSlug: 'ancien', resolvedSlug: null })).toBeNull();
    expect(buildResolvedTenantPath({ ...base, oldSlug: 'ancien', resolvedSlug: 'ancien' })).toBeNull();
  });
});
