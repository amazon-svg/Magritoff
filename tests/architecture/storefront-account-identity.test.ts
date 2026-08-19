import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const storefront = readFileSync(resolve(process.cwd(), 'src/app/components/shop/PublicShop.tsx'), 'utf8');
const orderLifecycle = readFileSync(resolve(process.cwd(), 'src/app/hooks/useStorefrontOrderLifecycle.ts'), 'utf8');
const layout = readFileSync(resolve(process.cwd(), 'src/app/components/shop/ShopLayout.tsx'), 'utf8');
const account = readFileSync(resolve(process.cwd(), 'src/app/components/shop/portal/AccountHub.tsx'), 'utf8');

describe('identité du compte storefront', () => {
  it('affiche le client boutique sans réutiliser le menu Magrit', () => {
    expect(layout).toContain('storefrontSession?.customer.fullName');
    expect(layout).not.toContain('AuthMenu');
    expect(account).toContain('session.customer.fullName');
    expect(account).toContain('session.customer.email');
    expect(account).not.toContain('useAuth');
    expect(account).not.toContain('useTenant');
  });

  it('transmet la session au chrome, au profil et à la confirmation', () => {
    expect(storefront).toContain('storefrontSession={storefrontSession}');
    expect(storefront).toContain('onAuthenticated={setStorefrontSession}');
    expect(storefront).toContain('onSignOut={endStorefrontSession}');
    expect(storefront).toContain("storefrontSession?.customer.email ?? ''");
  });

  it('demande une session boutique avant d afficher les données du compte', () => {
    expect(account).toContain('if (!hasCurrentShopSession)');
    expect(account).toContain('<StorefrontLoginForm');
    expect(account).toContain("allowRegistration={shop.access_mode === 'self_signup'}");
    expect(account).toContain('onAuthenticated={onAuthenticated}');
  });

  it('autorise une commande avec la session boutique sans exiger Supabase Auth', () => {
    expect(storefront).toContain('sessionShopId: storefrontSession?.identity.shopId ?? null');
    expect(orderLifecycle).toContain('if (sessionShopId !== shop.id)');
    expect(storefront).not.toContain('useAuth');
    expect(orderLifecycle).not.toContain('useAuth');
  });
});
