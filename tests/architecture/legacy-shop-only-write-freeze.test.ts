import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260817000800_freeze_legacy_shop_only_writes.sql',
), 'utf8');

describe('UM8.1 gel du modèle shop_only', () => {
  it('bloque les nouveaux membres et invitations mixtes au niveau DB', () => {
    expect(migration).toContain('tenant_members_freeze_legacy_shop_only');
    expect(migration).toContain('tenant_invitations_freeze_legacy_shop_only');
    expect(migration).toContain("tg_op = 'INSERT' and new.access_scope = 'shop_only'");
    expect(migration).toContain('legacy_shop_only_frozen');
  });

  it('autorise la reprise contrôlée des migrations et la promotion vers Magrit', () => {
    expect(migration).toContain("session_user = 'postgres'");
    expect(migration).toContain("new.access_scope = 'shop_only'");
    expect(migration).not.toMatch(/delete\s+from\s+public\.tenant_members/i);
  });
});
