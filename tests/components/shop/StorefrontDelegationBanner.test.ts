import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const banner = readFileSync(
  resolve(process.cwd(), 'src/app/components/shop/StorefrontDelegationBanner.tsx'),
  'utf8',
);
const shop = readFileSync(
  resolve(process.cwd(), 'src/app/components/shop/PublicShop.tsx'),
  'utf8',
);

describe('bandeau de délégation storefront', () => {
  it('reste distinct du contenu boutique et permet de quitter le mode', () => {
    expect(banner).toContain("session.identity.kind !== 'delegated_shop_customer'");
    expect(banner).toContain('Vos actions restent attribuées à votre compte Magrit.');
    expect(banner).toContain('Quitter ce mode');
  });

  it('lit et ferme la session via la façade anonyme', () => {
    expect(shop).toContain('storefrontIdentityApi.current()');
    expect(shop).toContain('await storefrontIdentityApi.end()');
    expect(shop).toContain('StorefrontDelegationBanner');
    expect(shop).not.toMatch(/supabase\s*\./);
  });
});
