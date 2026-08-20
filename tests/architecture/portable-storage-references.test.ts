import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260817000600_portable_shop_storage_references.sql',
), 'utf8');

describe('références Storage portables', () => {
  it('retire uniquement l origine des assets Storage de boutique existants', () => {
    expect(migration).toContain("'^https?://[^/]+(/storage/v1/object/.*)$'");
    expect(migration).toContain('update public.shops');
    expect(migration).toContain('update public.shop_template_mockups');
    expect(migration).not.toContain('product_library');
  });
});
