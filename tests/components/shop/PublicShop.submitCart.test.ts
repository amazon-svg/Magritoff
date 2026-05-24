/**
 * Tests vitest pour la garantie defensive S3.2-residual AC2 :
 * submitCart() insere TOUJOURS status='draft' explicite dans tenant_orders,
 * meme si le default DB venait a changer.
 *
 * Le default DB tenant_orders.status = 'draft' est confirme par la migration
 * source supabase/migrations/20260509_01_e1_orders_v1_1.sql ligne :
 *   status tenant_order_status not null default 'draft'
 *
 * Cette story (S3.2-residual) ajoute une defense en profondeur : le code
 * applicatif submitCart() explicite 'draft' (PublicShop.tsx ligne ~295)
 * pour ne pas dependre du default si une migration future le change.
 *
 * Test : lecture statique du fichier source + grep du pattern.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('S3.2-residual AC2 — submitCart() insere status=draft explicite', () => {
  it("PublicShop.tsx contient 'status: \"draft\"' dans le payload tenant_orders.insert", () => {
    const src = readFileSync(
      resolve(__dirname, '../../../src/app/components/shop/PublicShop.tsx'),
      'utf-8',
    );
    // Match les formes possibles : status: 'draft' ou status: "draft" (avec
    // ou sans virgule, espaces variables).
    expect(src).toMatch(/status\s*:\s*['"]draft['"]/);
  });

  it("la migration source 20260509 declare bien default 'draft' pour tenant_orders.status (assurance back-compat)", () => {
    const sql = readFileSync(
      resolve(__dirname, '../../../supabase/migrations/20260509_01_e1_orders_v1_1.sql'),
      'utf-8',
    );
    expect(sql).toMatch(/status\s+tenant_order_status\s+not null\s+default\s+'draft'/);
  });
});
