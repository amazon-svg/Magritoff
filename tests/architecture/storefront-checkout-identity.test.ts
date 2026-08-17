import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const checkout = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/CheckoutPage.tsx'), 'utf8');
const forbidden = readFileSync(resolve(process.cwd(), 'src/app/components/shop/ShopForbidden403.tsx'), 'utf8');
const login = readFileSync(resolve(process.cwd(), 'src/app/components/shop/StorefrontLoginForm.tsx'), 'utf8');
const client = readFileSync(resolve(process.cwd(), 'src/modules/shop-customers/api/storefront-client.ts'), 'utf8');

describe('identité boutique du checkout', () => {
  it('connecte la boutique privée avant toute exposition de son contenu', () => {
    expect(forbidden).toContain('StorefrontLoginForm');
    expect(forbidden).not.toContain('LoginModal');
    expect(forbidden).not.toContain('ForgotPasswordModal');
  });

  it('utilise le BFF storefront et non Supabase Auth', () => {
    expect(login).toContain('api.authenticate(shopSlug');
    expect(client).toContain('/storefront/${encodeURIComponent(shopSlug)}/session');
    for (const source of [checkout, forbidden, login]) {
      expect(source).not.toContain('useAuth');
      expect(source).not.toContain('signIn');
      expect(source).not.toContain('signUp');
    }
  });

  it('rend visible la séparation avec la connexion Magrit', () => {
    expect(login).toContain('Ce compte est indépendant de votre accès Magrit');
    expect(login).toContain('Accéder à mes espaces Magrit');
    expect(login).toContain('to="/tenants"');
  });

  it('autorise la commande uniquement avec la session de la boutique exacte', () => {
    expect(checkout).toContain('storefrontSession?.identity.shopId === shop.id');
    expect(checkout).toContain('disabled={!hasStorefrontSession || !canCreateOrder || submitting}');
  });
});
