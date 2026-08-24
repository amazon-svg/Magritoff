import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('UM1 règles fonctionnelles de gestion des utilisateurs', () => {
  it('protège transactionnellement le dernier admin', () => {
    const migration = read('supabase/migrations/20260824000200_um1_admin_shop_guards.sql');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('tenant_members_protect_last_admin');
    expect(migration).toContain("message = 'last_admin_protected'");
    expect(migration).toContain('tenant_role_assignments_only_options');
  });

  it('réserve les écritures boutique aux admins et à option_shops sur ses boutiques', () => {
    const migration = read('supabase/migrations/20260824000200_um1_admin_shop_guards.sql');
    expect(migration).toContain('public.can_manage_shop');
    expect(migration).toContain("'can_manage_shops'");
    expect(migration).toContain('shop.owner_user_id = auth.uid()');
    expect(migration).toContain('member.role = \'admin\'');
  });

  it('réserve le pilotage des commandes à option_orders', () => {
    const migration = read('supabase/migrations/20260824000400_um1_order_option_enforcement.sql');
    expect(migration).toContain('public.can_manage_tenant_orders');
    expect(migration).toContain("'can_validate'");
    expect(migration).toContain('tenant_orders_select');
  });

  it('réserve aux admins l héritage des sous-espaces', () => {
    const migration = read('supabase/migrations/20260824000500_um1_admin_subtenant_inheritance.sql');
    expect(migration).toContain("member.role = 'admin'");
    expect(migration).toContain("member.access_scope = 'magrit_full'");
  });

  it('conserve les commandes validées lors d une suppression définitive', () => {
    const migration = read('supabase/migrations/20260824000300_um1_shop_lifecycle.sql');
    expect(migration).toContain("status in ('draft', 'cancelled')");
    expect(migration).toContain('deleted_at = now()');
    expect(migration).toContain("status = 'suspended'");
  });

  it('n expose que les profils et options produit dans l écran équipe', () => {
    const users = read('src/modules/members/ui/workspace/MembersPage.tsx');
    const invite = read('src/modules/members/ui/components/InviteMemberDialog.tsx');
    expect(users).not.toContain('<DashboardRolesSection');
    expect(users).toContain("member.access_scope === 'magrit_full'");
    expect(invite).toContain("role.systemKey === 'option_shops'");
    expect(invite).toContain("role.systemKey === 'option_orders'");
    expect(invite).toContain("['admin', 'Administrateur'");
  });

  it('seed les options, sans recréer le catalogue historique', () => {
    const migration = read('supabase/migrations/20260824000600_um1_seed_profile_options.sql');
    expect(migration).toContain("'option_shops'");
    expect(migration).toContain("'option_orders'");
    expect(migration).not.toContain("new.id, 'Owner'");
    expect(migration).not.toContain("new.id, 'Validateur'");
  });
});
