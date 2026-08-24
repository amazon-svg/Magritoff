/**
 * Garanties de creation d'une commande depuis la boutique publique.
 *
 * Depuis AF5.2a, le front ne construit plus directement tenant_orders et ses
 * lignes : l'API Orders appelle une commande SQL atomique. Le statut initial
 * reste explicitement fixe a `draft`, mais dans la frontiere transactionnelle
 * serveur qui en est desormais proprietaire.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AF5.2a — submitCart() delegue la creation atomique a Orders', () => {
  it('PublicShop délègue au cycle Orders sans écrire directement les tables', () => {
    const src = readFileSync(
      resolve(__dirname, '../../../src/modules/shops/ui/storefront/PublicShop.tsx'),
      'utf-8',
    );
    const lifecycle = readFileSync(
      resolve(__dirname, '../../../src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts'),
      'utf-8',
    );

    expect(src).toContain('useStorefrontOrderLifecycle({');
    expect(src).not.toMatch(/ordersApi\./);
    expect(lifecycle).toMatch(/ordersApi\.create\s*\(/);
    for (const source of [src, lifecycle]) {
      expect(source).not.toMatch(/\.from\(['"]tenant_orders['"]\)\s*\.insert/);
      expect(source).not.toMatch(/\.from\(['"]tenant_order_items['"]\)\s*\.insert/);
    }
  });

  it('le CTA du drawer soumet réellement quand le checkout est déjà affiché', () => {
    const src = readFileSync(
      resolve(__dirname, '../../../src/modules/shops/ui/storefront/PublicShop.tsx'),
      'utf-8',
    );

    expect(src).toContain("if (view === 'checkout')");
    expect(src).toContain('void submitCart();');
  });

  it('le drawer se ferme en arrivant au checkout et après confirmation', () => {
    const layout = readFileSync(
      resolve(__dirname, '../../../src/modules/shops/ui/storefront/ShopLayout.tsx'),
      'utf-8',
    );

    expect(layout).toContain('view === "checkout" || view === "thankYou"');
    expect(layout).toContain('setCartOpen(false)');
  });

  it("la commande SQL atomique impose explicitement le statut initial 'draft'", () => {
    const sql = readFileSync(
      resolve(__dirname, '../../../supabase/migrations/20260811000400_api_create_order_atomic.sql'),
      'utf-8',
    );

    expect(sql).toMatch(/insert\s+into\s+public\.tenant_orders/i);
    expect(sql).toMatch(/values\s*\([\s\S]*?'draft'/i);
    expect(sql).toMatch(/insert\s+into\s+public\.tenant_order_items/i);
  });
});
