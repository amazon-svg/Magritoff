import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const banner = readFileSync(
  resolve(process.cwd(), 'src/modules/shop-customers/ui/storefront/StorefrontDelegationBanner.tsx'),
  'utf8',
);
const shop = readFileSync(
  resolve(process.cwd(), 'src/modules/shops/ui/storefront/PublicShop.tsx'),
  'utf8',
);
const sessionHook = readFileSync(
  resolve(process.cwd(), 'src/modules/shop-customers/ui/hooks/useStorefrontSession.ts'),
  'utf8',
);

describe('bandeau de délégation storefront', () => {
  it('reste distinct du contenu boutique et permet de quitter le mode', () => {
    expect(banner).toContain("session.identity.kind !== 'delegated_shop_customer'");
    expect(banner).toContain('Vos actions restent attribuées à votre compte Magrit.');
    expect(banner).toContain('Quitter ce mode');
  });

  it('lit et ferme la session via la façade anonyme', () => {
    expect(shop).toContain('useStorefrontSession()');
    // BCP-6b (correction qa-review round 2) — la lecture de session est
    // désormais portée par `createSessionChecker` (`params.api.current()`),
    // pas directement par `checkCurrent` du hook.
    expect(sessionHook).toContain('await params.api.current()');
    expect(sessionHook).toContain('await api.end()');
    // BCP-6b (CONVENTIONS.md §8.25 point 5.2) — `focus` est retiré au profit
    // de `visibilitychange`, seul déclencheur de revalidation au repos.
    expect(sessionHook).toContain("document.addEventListener('visibilitychange'");
    expect(sessionHook).not.toMatch(/addEventListener\(\s*['"]focus['"]/);
    expect(sessionHook).toContain('document.visibilityState');
    expect(shop).toContain('StorefrontDelegationBanner');
    expect(shop).not.toMatch(/supabase\s*\./);
    expect(sessionHook).not.toMatch(/supabase\s*\./);
  });
});
