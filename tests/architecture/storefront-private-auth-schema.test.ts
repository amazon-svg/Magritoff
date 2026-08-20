import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260816000300_private_storefront_credentials_sessions.sql',
  ),
  'utf8',
);

describe('stockage privé de l authentification storefront', () => {
  it('place credentials et sessions hors du schéma PostgREST public', () => {
    expect(migration).toContain('create schema if not exists private');
    expect(migration).toContain('private.shop_customer_credentials');
    expect(migration).toContain('private.shop_customer_sessions');
    expect(migration).toContain('revoke all on schema private from public, anon, authenticated');
    expect(migration).not.toContain('create table if not exists public.shop_customer_credentials');
  });

  it('ne stocke que des hashes et lie chaque session à la même boutique', () => {
    expect(migration).toContain('password_hash text not null');
    expect(migration).toContain("password_algorithm in ('bcrypt-sha256-v1')");
    expect(migration).toContain('token_hash bytea not null unique');
    expect(migration).toContain('check (octet_length(token_hash) = 32)');
    expect(migration).toContain('foreign key (shop_customer_account_id, shop_id)');
    expect(migration).not.toMatch(/\n\s+password text\b/);
    expect(migration).not.toMatch(/\n\s+token text\b/);
  });

  it('reste default-deny sans service role ni RPC publique prématurée', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table private.shop_customer_credentials');
    expect(migration).toContain('revoke all on table private.shop_customer_sessions');
    expect(migration).not.toMatch(/grant\s+.+\s+to\s+service_role/i);
    expect(migration).not.toContain('grant execute');
  });
});
