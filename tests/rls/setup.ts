/**
 * Harness pour les tests RLS d etancheite multi-tenant.
 *
 * Utilise un client service_role pour creer 2 users + 2 tenants jetables, puis
 * expose 2 clients anon authentifies (un par user) que les tests peuvent
 * utiliser pour simuler des appels RLS-checked depuis le front.
 *
 * Variables d env requises (cf. .env.test) :
 *   SUPABASE_URL                   = https://ightkxebexuzfjdbpsdg.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY      = <service role>
 *   SUPABASE_ANON_KEY              = <anon>
 *
 * Si l une manque, le harness exporte SKIP=true pour que les tests soient
 * marques comme skipped (et non echoues) en local sans creds.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface RlsHarness {
  admin: SupabaseClient;     // service_role
  anonA: SupabaseClient;     // user A authentifie
  anonB: SupabaseClient;     // user B authentifie
  userA: { id: string; email: string };
  userB: { id: string; email: string };
  tenantA: { id: string; slug: string };
  tenantB: { id: string; slug: string };
  cleanup: () => Promise<void>;
}

export const SKIP_REASON = (() => {
  const env = process.env;
  if (!env.SUPABASE_URL) return 'SUPABASE_URL absent';
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY absent';
  if (!env.SUPABASE_ANON_KEY) return 'SUPABASE_ANON_KEY absent';
  return null;
})();

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

export async function bootstrapHarness(): Promise<RlsHarness> {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.SUPABASE_ANON_KEY!;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tag = rid();
  const emailA = `rls-test-a-${tag}@magrit.test`;
  const emailB = `rls-test-b-${tag}@magrit.test`;
  const password = `rls-${tag}-${rid()}`;

  const { data: a, error: aErr } = await admin.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (aErr || !a.user) throw new Error(`createUser A failed: ${aErr?.message}`);

  const { data: b, error: bErr } = await admin.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  });
  if (bErr || !b.user) throw new Error(`createUser B failed: ${bErr?.message}`);

  // Cree un tenant par user via service_role + insert direct
  // (RLS bypassed). On ajoute le user comme owner dans tenant_members.
  const slugA = `rls-test-a-${tag}`;
  const slugB = `rls-test-b-${tag}`;
  const { data: tA, error: tAErr } = await admin
    .from('tenants')
    .insert({ slug: slugA, name: `RLS Test A ${tag}` })
    .select('id, slug')
    .single();
  if (tAErr || !tA) throw new Error(`tenant A insert: ${tAErr?.message}`);
  const { data: tB, error: tBErr } = await admin
    .from('tenants')
    .insert({ slug: slugB, name: `RLS Test B ${tag}` })
    .select('id, slug')
    .single();
  if (tBErr || !tB) throw new Error(`tenant B insert: ${tBErr?.message}`);

  await admin.from('tenant_members').insert([
    { tenant_id: tA.id, user_id: a.user.id, role: 'owner', access_scope: 'magrit_full' },
    { tenant_id: tB.id, user_id: b.user.id, role: 'owner', access_scope: 'magrit_full' },
  ]);

  // Cree 2 clients anon, un signIn par user pour avoir leur JWT
  const anonA = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonB = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signA } = await anonA.auth.signInWithPassword({
    email: emailA,
    password,
  });
  if (signA) throw new Error(`signIn A: ${signA.message}`);
  const { error: signB } = await anonB.auth.signInWithPassword({
    email: emailB,
    password,
  });
  if (signB) throw new Error(`signIn B: ${signB.message}`);

  const cleanup = async () => {
    // Ordre : memberships -> tenants -> users
    await admin.from('tenant_members').delete().in('tenant_id', [tA.id, tB.id]);
    await admin.from('tenants').delete().in('id', [tA.id, tB.id]);
    await admin.auth.admin.deleteUser(a.user!.id).catch(() => {});
    await admin.auth.admin.deleteUser(b.user!.id).catch(() => {});
  };

  return {
    admin,
    anonA,
    anonB,
    userA: { id: a.user.id, email: emailA },
    userB: { id: b.user.id, email: emailB },
    tenantA: { id: tA.id, slug: tA.slug },
    tenantB: { id: tB.id, slug: tB.slug },
    cleanup,
  };
}
