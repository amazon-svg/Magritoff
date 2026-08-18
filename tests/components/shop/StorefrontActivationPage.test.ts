import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/app/components/shop/StorefrontActivationPage.tsx'),
  'utf8',
);

describe('StorefrontActivationPage', () => {
  it('passe par la façade storefront anonyme sans accès direct à Supabase', () => {
    expect(source).toContain('useStorefrontIdentityApi');
    expect(source).toContain('api.activate({ token, password })');
    expect(source).not.toContain('supabase');
  });

  it('entre directement dans la boutique après la création de la session', () => {
    expect(source).toContain('useNavigate()');
    expect(source).toContain("navigate(`/shop/${encodeURIComponent(slug)}`, { replace: true })");
    expect(source).not.toContain('Accéder à la boutique');
  });

  it('explique la séparation des mots de passe et neutralise les erreurs de jeton', () => {
    expect(source).toContain('Il n’est pas partagé avec votre compte Magrit ni avec une autre boutique.');
    expect(source).toContain('invalide, expiré ou déjà utilisé');
    expect(source).not.toContain('cause instanceof');
  });
});
