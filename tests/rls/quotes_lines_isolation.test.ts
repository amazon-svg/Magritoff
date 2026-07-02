/**
 * S-QUOTES-1 — Tests RLS bibliotheque de devis editables.
 *
 * Verifie que quotes (evoluee) et quote_lines (nouvelle) sont strictement
 * etanches multi-tenant, et que l'override admin/owner tenant fonctionne
 * (l'auteur edite ses devis, l'admin/owner tenant edite tous les devis du
 * tenant). Calque sur orders_isolation.test.ts (S1.4).
 *
 * Cas :
 *   1. cross-tenant SELECT bloque (user A ne lit pas les devis du tenant B)
 *   2. cross-tenant INSERT bloque
 *   3. INSERT de son propre devis + ligne OK
 *   4. quote_lines cross-tenant SELECT bloque (heritage parent)
 *   5. override owner tenant : le owner edite le devis d'un autre membre
 *   6. un membre d'un autre tenant ne peut PAS editer le devis
 *
 * Lancer : pnpm test (necessite .env.test avec SUPABASE_URL +
 * SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY).
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapHarness, RlsHarness, SKIP_REASON } from './setup';

const describeIfCreds = SKIP_REASON ? describe.skip : describe;

describeIfCreds('RLS devis editables isolation (S-QUOTES-1)', () => {
  let h: RlsHarness;
  const quotesToCleanup: string[] = [];

  beforeAll(async () => {
    h = await bootstrapHarness();
  }, 30_000);

  afterEach(async () => {
    if (quotesToCleanup.length > 0) {
      // quote_lines supprimees en cascade via FK on delete cascade
      await h.admin.from('quotes').delete().in('id', quotesToCleanup);
      quotesToCleanup.length = 0;
    }
  });

  // Helper : cree un devis via service_role (bypass RLS) pour les setups
  async function adminCreateQuote(args: {
    tenant_id: string;
    user_id: string;
    status?: string;
    total_ht?: number;
  }) {
    const { data, error } = await h.admin
      .from('quotes')
      .insert({
        tenant_id: args.tenant_id,
        user_id: args.user_id,
        reference: `DEV-RLS-${Math.random().toString(36).slice(2, 8)}`,
        product_name: 'Produit RLS',
        status: args.status ?? 'draft',
        total_ht: args.total_ht ?? 100.0,
        total_ttc: (args.total_ht ?? 100.0) * 1.2,
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`adminCreateQuote failed: ${error?.message}`);
    quotesToCleanup.push(data.id);
    return data.id as string;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Cas 1 — cross-tenant SELECT bloque
  // ───────────────────────────────────────────────────────────────────────
  it('Cas 1 — user A ne lit pas les devis du tenant B', async () => {
    await adminCreateQuote({ tenant_id: h.tenantB.id, user_id: h.userB.id });
    const { data, error } = await h.anonA
      .from('quotes')
      .select('id, tenant_id')
      .eq('tenant_id', h.tenantB.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────
  // Cas 2 — cross-tenant INSERT bloque
  // ───────────────────────────────────────────────────────────────────────
  it('Cas 2 — user A ne peut pas creer un devis dans le tenant B', async () => {
    const { data, error } = await h.anonA.from('quotes').insert({
      tenant_id: h.tenantB.id,
      user_id: h.userA.id,
      reference: 'DEV-RLS-HACK',
      product_name: 'Hack',
      status: 'draft',
      total_ht: 50.0,
    });
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────
  // Cas 3 — INSERT de son propre devis + ligne OK
  // ───────────────────────────────────────────────────────────────────────
  it('Cas 3 — user A cree son devis et une ligne', async () => {
    const { data: q, error: qErr } = await h.anonA
      .from('quotes')
      .insert({
        tenant_id: h.tenantA.id,
        user_id: h.userA.id,
        reference: 'DEV-RLS-OK',
        product_name: 'Cartes de visite',
        status: 'draft',
        total_ht: 80.0,
        total_ttc: 96.0,
      })
      .select('id')
      .single();
    expect(qErr).toBeNull();
    expect(q?.id).toBeTruthy();
    if (q?.id) quotesToCleanup.push(q.id);

    const { error: lineErr } = await h.anonA.from('quote_lines').insert({
      quote_id: q!.id,
      product_name: 'Cartes de visite',
      quantity: 500,
      unit_cost_ht: 0.1,
      unit_price_ht: 0.16,
      margin_pct: 60,
      line_total_ht: 80.0,
      position: 0,
    });
    expect(lineErr).toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Cas 4 — quote_lines cross-tenant SELECT bloque (heritage parent)
  // ───────────────────────────────────────────────────────────────────────
  it('Cas 4 — user A ne lit pas les lignes d un devis du tenant B', async () => {
    const quoteB = await adminCreateQuote({ tenant_id: h.tenantB.id, user_id: h.userB.id });
    await h.admin.from('quote_lines').insert({
      quote_id: quoteB,
      product_name: 'Flyer',
      quantity: 1000,
      unit_price_ht: 120,
      line_total_ht: 120,
      position: 0,
    });
    const { data, error } = await h.anonA
      .from('quote_lines')
      .select('id')
      .eq('quote_id', quoteB);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  // ───────────────────────────────────────────────────────────────────────
  // Cas 5 — override owner tenant : le owner edite le devis d un autre membre
  // ───────────────────────────────────────────────────────────────────────
  it('Cas 5 — le owner du tenant A edite le devis cree par un autre membre', async () => {
    // Cree un 2eme user membre (role member) du tenant A
    const tag = Math.random().toString(36).slice(2, 8);
    const { data: c } = await h.admin.auth.admin.createUser({
      email: `rls-quote-c-${tag}@magrit.test`,
      password: `rls-${tag}`,
      email_confirm: true,
    });
    if (!c?.user) throw new Error('createUser C failed');
    await h.admin.from('tenant_members').insert({
      tenant_id: h.tenantA.id,
      user_id: c.user.id,
      role: 'member',
      access_scope: 'magrit_full',
    });

    // Devis appartenant au membre C
    const quoteC = await adminCreateQuote({
      tenant_id: h.tenantA.id,
      user_id: c.user.id,
      status: 'draft',
    });

    // userA (owner du tenant A) valide le devis de C -> autorise par override
    const { error } = await h.anonA
      .from('quotes')
      .update({ status: 'validated' })
      .eq('id', quoteC);
    expect(error).toBeNull();

    const { data } = await h.admin
      .from('quotes')
      .select('status')
      .eq('id', quoteC)
      .single();
    expect(data?.status).toBe('validated');

    // Cleanup user C
    await h.admin.from('tenant_members').delete().eq('user_id', c.user.id);
    await h.admin.auth.admin.deleteUser(c.user.id).catch(() => {});
  });

  // ───────────────────────────────────────────────────────────────────────
  // Cas 6 — un membre d un autre tenant ne peut pas editer le devis
  // ───────────────────────────────────────────────────────────────────────
  it('Cas 6 — user B ne peut pas editer un devis du tenant A', async () => {
    const quoteA = await adminCreateQuote({ tenant_id: h.tenantA.id, user_id: h.userA.id });
    await h.anonB.from('quotes').update({ status: 'rejected' }).eq('id', quoteA);
    // Le statut ne doit pas avoir change
    const { data } = await h.admin
      .from('quotes')
      .select('status')
      .eq('id', quoteA)
      .single();
    expect(data?.status).toBe('draft');
  });
});
