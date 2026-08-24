import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260816000400_storefront_authentication_primitive.sql',
  ),
  'utf8',
);

describe('primitive SQL d authentification storefront', () => {
  it('garde toute la vérification et l émission dans une fonction atomique', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('for update');
    expect(migration).toContain('private.shop_customer_credentials');
    expect(migration).toContain('private.shop_customer_sessions');
    expect(migration).toContain("extensions.digest(convert_to(v_token, 'UTF8'), 'sha256')");
  });

  it('effectue un hash factice et ne différencie aucun refus', () => {
    expect(migration.match(/dummy_password_hash/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).not.toContain('raise exception');
    expect(migration).not.toContain('account_not_found');
    expect(migration).not.toContain('invalid_password');
  });

  it('limite les tentatives et ne conserve jamais le jeton brut', () => {
    expect(migration).toContain('max_failed_attempts integer not null default 5');
    expect(migration).toContain('lock_seconds integer not null default 900');
    expect(migration).toContain('failed_attempt_count = v_next_failed_attempts');
    expect(migration).toContain('token_hash');
    expect(migration).not.toMatch(/insert into private\.shop_customer_sessions[\s\S]+opaque_token/i);
  });

  it('n accorde que l exécution minimale à anon', () => {
    expect(migration).toContain('revoke all on function public.api_authenticate_shop_customer');
    expect(migration).toContain('to anon');
    expect(migration).not.toMatch(/grant\s+.+\s+to\s+service_role/i);
  });
});
