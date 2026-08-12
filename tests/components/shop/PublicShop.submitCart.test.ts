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
  it('PublicShop utilise OrdersApiClient sans ecrire directement les tables Orders', () => {
    const src = readFileSync(
      resolve(__dirname, '../../../src/app/components/shop/PublicShop.tsx'),
      'utf-8',
    );

    expect(src).toMatch(/ordersApi\.create\s*\(/);
    expect(src).not.toMatch(/\.from\(['"]tenant_orders['"]\)\s*\.insert/);
    expect(src).not.toMatch(/\.from\(['"]tenant_order_items['"]\)\s*\.insert/);
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
