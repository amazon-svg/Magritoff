import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = readFileSync(resolve(process.cwd(), 'src/server/api/shops-routes.ts'), 'utf8');
const repository = readFileSync(resolve(process.cwd(), 'src/adapters/supabase/shops-repository.ts'), 'utf8');
const storefront = readFileSync(resolve(process.cwd(), 'src/app/components/shop/PublicShop.tsx'), 'utf8');

describe('accès catalogue par session storefront', () => {
  it('résout le cookie côté serveur sans le transmettre au module Shops', () => {
    expect(routes).toContain('readStorefrontSessionCookie');
    expect(routes).toContain("kind: 'shop_customer'");
    expect(routes).not.toContain('opaqueToken: token');
  });

  it('borne le catalogue à la boutique portée par la session', () => {
    expect(repository).toContain('access.storefront?.shopId !== gate.id');
    expect(repository).not.toContain('access.magritUserId');
    expect(repository).not.toContain('current_user_can_access_shop');
  });

  it('attend la résolution storefront avant de charger un catalogue privé', () => {
    expect(storefront).toContain('storefrontSessionLoading');
    expect(storefront).toContain('storefrontShopId: storefrontSession?.identity.shopId ?? null');
    expect(storefront).not.toContain('resolveShopAccessFromMemberships');
    expect(storefront).not.toContain('useTenant');
    expect(storefront).not.toContain('useAuth');
  });
});
