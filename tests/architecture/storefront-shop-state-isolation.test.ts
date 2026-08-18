import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const storefront = readFileSync(resolve(
  process.cwd(), 'src/app/components/shop/PublicShop.tsx',
), 'utf8');

describe('UM10.4 isolation des états entre boutiques', () => {
  it('réinitialise les données transactionnelles lors du changement de slug', () => {
    const boundary = storefront.slice(
      storefront.indexOf('// UM10.4'),
      storefront.indexOf('const selectSubcategory'),
    );

    expect(boundary).toContain('setCart([])');
    expect(boundary).toContain('setRenewalWarnings([])');
    expect(boundary).toContain('setLastOrderId(null)');
    expect(boundary).toContain('setLastOrder(null)');
    expect(boundary).toContain('setPendingFormat(null)');
    expect(boundary).toContain('checkoutCommandKey.current = crypto.randomUUID()');
    expect(boundary).toContain('}, [slug])');
  });

  it('ne peint jamais la boutique précédente sous le nouveau slug', () => {
    expect(storefront).toContain("shop !== null && shop.slug !== slug");
  });
});
