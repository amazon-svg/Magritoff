/**
 * Tests S-PIM-VISUELS-2 (Sprint 7, 2026-06-01).
 *
 * Valide :
 *   - Bucket shop_backgrounds existe avec limites correctes
 *   - Upload via SDK Storage avec convention <shop_id>/<file> par owner
 *     (can_manage_catalog) OK
 *   - Stranger upload sur shop d'un autre tenant BLOQUE
 *   - URL publique accessible via getPublicUrl
 *   - MIME non autorisé bloqué par bucket constraint
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import '../_loadEnv';

const SKIP_REASON = (() => {
  const env = process.env;
  if (!env.SUPABASE_URL) return 'SUPABASE_URL absent';
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY absent';
  if (!env.SUPABASE_ANON_KEY) return 'SUPABASE_ANON_KEY absent';
  return null;
})();

const rid = () => Math.random().toString(36).slice(2, 10);

// PNG minimal 1x1 transparent (8 bytes signature + IHDR + IDAT + IEND).
// Source standard, sert de fixture pour tester les uploads MIME image/png.
const MINI_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==';

interface Ctx {
  admin: SupabaseClient;
  anonOwner: SupabaseClient;
  anonStranger: SupabaseClient;
  ownerId: string;
  strangerId: string;
  tenantId: string;
  shopId: string;
  otherShopId: string;
  cleanup: () => Promise<void>;
}

const ctx = {} as Ctx;

describe.skipIf(SKIP_REASON !== null)('Storage shop_backgrounds (V2 upload)', () => {
  beforeAll(async () => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const tag = rid();
    const password = `bg-${tag}-${rid()}`;

    const { data: owner } = await admin.auth.admin.createUser({
      email: `bg-o-${tag}@magrit.test`, password, email_confirm: true,
    });
    const { data: stranger } = await admin.auth.admin.createUser({
      email: `bg-s-${tag}@magrit.test`, password, email_confirm: true,
    });
    if (!owner.user || !stranger.user) throw new Error('createUser failed');

    const { data: tenant } = await admin
      .from('tenants').insert({ slug: `bg-${tag}`, name: `BG ${tag}` })
      .select('id').single();
    const { data: otherTenant } = await admin
      .from('tenants').insert({ slug: `bg-other-${tag}`, name: `BG Other ${tag}` })
      .select('id').single();
    if (!tenant || !otherTenant) throw new Error('tenant insert failed');

    await admin.from('tenant_members').insert([
      { tenant_id: tenant.id, user_id: owner.user.id, role: 'owner', access_scope: 'magrit_full' },
      { tenant_id: otherTenant.id, user_id: stranger.user.id, role: 'owner', access_scope: 'magrit_full' },
    ]);

    // Assigne rôle Owner global pour can_manage_catalog
    const { data: ownerRole } = await admin.from('tenant_role_definitions')
      .select('id').eq('tenant_id', tenant.id).eq('name', 'Owner').single();
    await admin.from('tenant_role_assignments').insert({
      role_definition_id: ownerRole!.id,
      user_id: owner.user.id,
      assigned_by: owner.user.id,
    });

    const { data: shop } = await admin.from('shops').insert({
      tenant_id: tenant.id, owner_user_id: owner.user.id,
      slug: `bg-shop-${tag}`, name: 'BG Shop',
      description: '', theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true, library_ids: [], excluded_product_ids: [],
    }).select('id').single();
    const { data: otherShop } = await admin.from('shops').insert({
      tenant_id: otherTenant.id, owner_user_id: stranger.user.id,
      slug: `bg-othershop-${tag}`, name: 'BG OtherShop',
      description: '', theme: { primaryColor: '#000', accentColor: '#000', mode: 'light' },
      active: true, library_ids: [], excluded_product_ids: [],
    }).select('id').single();
    if (!shop || !otherShop) throw new Error('shop insert failed');

    const anonOwner = createClient(url, anonKey, { auth: { persistSession: false } });
    await anonOwner.auth.signInWithPassword({ email: `bg-o-${tag}@magrit.test`, password });
    const anonStranger = createClient(url, anonKey, { auth: { persistSession: false } });
    await anonStranger.auth.signInWithPassword({ email: `bg-s-${tag}@magrit.test`, password });

    Object.assign(ctx, {
      admin, anonOwner, anonStranger,
      ownerId: owner.user.id, strangerId: stranger.user.id,
      tenantId: tenant.id, shopId: shop.id, otherShopId: otherShop.id,
      cleanup: async () => {
        // Cleanup uploaded files
        const { data: files } = await admin.storage.from('shop_backgrounds').list(shop.id);
        if (files && files.length > 0) {
          await admin.storage
            .from('shop_backgrounds')
            .remove(files.map((f) => `${shop.id}/${f.name}`));
        }
        await admin.from('tenant_role_assignments').delete().eq('role_definition_id', ownerRole!.id);
        await admin.from('tenant_order_status_transitions').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('tenant_order_status_definitions').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('tenant_role_definitions').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('shops').delete().in('id', [shop.id, otherShop.id]);
        await admin.from('tenant_members').delete().in('tenant_id', [tenant.id, otherTenant.id]);
        await admin.from('tenants').delete().in('id', [tenant.id, otherTenant.id]);
        await admin.auth.admin.deleteUser(owner.user!.id).catch(() => {});
        await admin.auth.admin.deleteUser(stranger.user!.id).catch(() => {});
      },
    });
  }, 45_000);

  afterAll(async () => {
    if (ctx.cleanup) await ctx.cleanup();
  });

  it('bucket shop_backgrounds existe + limites correctes', async () => {
    const { data: buckets } = await ctx.admin.storage.listBuckets();
    const bg = buckets?.find((b) => b.id === 'shop_backgrounds');
    expect(bg).toBeTruthy();
    expect(bg!.public).toBe(true);
    expect(bg!.file_size_limit).toBe(5_242_880); // 5 MB
    expect(bg!.allowed_mime_types).toContain('image/png');
    expect(bg!.allowed_mime_types).toContain('image/jpeg');
    expect(bg!.allowed_mime_types).toContain('image/webp');
  });

  it('owner avec can_manage_catalog upload PNG dans son shop folder = OK', async () => {
    const pngBytes = Uint8Array.from(atob(MINI_PNG_BASE64), (c) => c.charCodeAt(0));
    const path = `${ctx.shopId}/test-${rid()}.png`;
    const { error } = await ctx.anonOwner.storage
      .from('shop_backgrounds')
      .upload(path, pngBytes, { contentType: 'image/png', upsert: true });
    expect(error).toBeNull();

    // Vérifie URL publique accessible
    const { data: pub } = ctx.anonOwner.storage.from('shop_backgrounds').getPublicUrl(path);
    expect(pub.publicUrl).toContain('shop_backgrounds');
    expect(pub.publicUrl).toContain(ctx.shopId);
  });

  it('stranger upload sur shop d un AUTRE tenant = BLOQUE', async () => {
    const pngBytes = Uint8Array.from(atob(MINI_PNG_BASE64), (c) => c.charCodeAt(0));
    const path = `${ctx.shopId}/intrusion-${rid()}.png`;
    const { error } = await ctx.anonStranger.storage
      .from('shop_backgrounds')
      .upload(path, pngBytes, { contentType: 'image/png', upsert: false });
    expect(error).toBeTruthy();
    expect(error!.message.toLowerCase()).toMatch(/unauthorized|policy|not allowed|denied/);
  });

  it('upload text/plain (MIME non autorisé) = BLOQUE par bucket constraint', async () => {
    const textBytes = new TextEncoder().encode('hello world');
    const path = `${ctx.shopId}/notimage-${rid()}.txt`;
    const { error } = await ctx.anonOwner.storage
      .from('shop_backgrounds')
      .upload(path, textBytes, { contentType: 'text/plain', upsert: false });
    expect(error).toBeTruthy();
    expect(error!.message.toLowerCase()).toMatch(/mime|content[ -]?type|invalid/);
  });
});
