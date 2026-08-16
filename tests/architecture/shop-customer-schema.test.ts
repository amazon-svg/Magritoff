import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260816000100_shop_customer_accounts.sql'),
  'utf8',
);

describe('schéma des comptes clients boutique', () => {
  it('isole l identité par boutique et email normalisé', () => {
    expect(migration).toContain('create table if not exists public.shop_customer_accounts');
    expect(migration).toContain('normalized_email text generated always as');
    expect(migration).toContain('unique (shop_id, normalized_email)');
    expect(migration).toContain("status in ('delegated_only', 'invited', 'active', 'suspended')");
  });

  it('sépare les références Auth et acteur Magrit', () => {
    expect(migration).toContain('auth_subject_id uuid unique');
    expect(migration).toContain('created_by_magrit_user_id uuid');
    expect(migration).not.toContain('tenant_member_id');
    expect(migration).not.toContain('allowed_shop_ids');
  });

  it('reste fermé par défaut avant le BFF et les capabilities dédiées', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table public.shop_customer_accounts');
    expect(migration).not.toContain('create policy');
  });
});
