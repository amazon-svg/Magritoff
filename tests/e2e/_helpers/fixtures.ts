import { adminClient, getSessionForCredentials, type AuthSession } from './auth';

const RID = () => Math.random().toString(36).slice(2, 10);

export interface ChromeFixtures {
  tenantId: string;
  tenantSlug: string;
  shopId: string;
  shopSlug: string;
  adminEmail: string;
  adminPassword: string;
  adminUserId: string;
  acheteurEmail: string;
  acheteurPassword: string;
  acheteurUserId: string;
  productId: string;
  productName: string;
  orderId: string;
  cleanup: () => Promise<void>;
}

export async function bootstrapChromeFixtures(): Promise<ChromeFixtures> {
  const admin = adminClient();
  const tag = RID();
  const adminEmail = `e2e-admin-${tag}@magrit.test`;
  const acheteurEmail = `e2e-acheteur-${tag}@magrit.test`;
  const password = `Pwd-${tag}-${RID()}`;

  const { data: adminUser, error: e1 } = await admin.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
  });
  if (e1 || !adminUser.user) throw new Error(`createUser admin: ${e1?.message}`);

  const { data: acheteurUser, error: e2 } = await admin.auth.admin.createUser({
    email: acheteurEmail,
    password,
    email_confirm: true,
  });
  if (e2 || !acheteurUser.user) throw new Error(`createUser acheteur: ${e2?.message}`);

  const tenantSlug = `e2e-${tag}`;
  const { data: tenant, error: e3 } = await admin
    .from('tenants')
    .insert({ slug: tenantSlug, name: `E2E ${tag}` })
    .select('id, slug')
    .single();
  if (e3 || !tenant) throw new Error(`tenant insert: ${e3?.message}`);

  await admin.from('tenant_members').insert([
    { tenant_id: tenant.id, user_id: adminUser.user.id, role: 'owner', access_scope: 'magrit_full' },
    {
      tenant_id: tenant.id,
      user_id: acheteurUser.user.id,
      role: 'member',
      access_scope: 'shop_only',
      permissions: { can_quote: false, can_order: true, can_invite: false },
    },
  ]);

  const shopSlug = `e2e-shop-${tag}`;
  const { data: shop, error: e4 } = await admin
    .from('shops')
    .insert({
      tenant_id: tenant.id,
      slug: shopSlug,
      name: `E2E Shop ${tag}`,
      owner_user_id: adminUser.user.id,
    })
    .select('id, slug')
    .single();
  if (e4 || !shop) throw new Error(`shop insert: ${e4?.message}`);

  await admin
    .from('tenant_members')
    .update({ allowed_shop_ids: [shop.id] })
    .eq('tenant_id', tenant.id)
    .eq('user_id', acheteurUser.user.id);

  const productName = `Flyer Test ${tag}`;
  const { data: product, error: e5 } = await admin
    .from('shop_products')
    .insert({
      shop_id: shop.id,
      tenant_id: tenant.id,
      name: productName,
      category: 'Flyer',
      description: 'Flyer test e2e',
      price_ht: 100.0,
      image_url: '',
      config: { paper: 'std', format: 'A5' },
    })
    .select('id')
    .single();
  if (e5 || !product) {
    throw new Error(`product insert: ${e5?.message}`);
  }

  const { data: order, error: e6 } = await admin
    .from('tenant_orders')
    .insert({
      tenant_id: tenant.id,
      shop_id: shop.id,
      created_by: acheteurUser.user.id,
      status: 'draft',
      total_ht: 250.0,
    })
    .select('id')
    .single();
  if (e6 || !order) throw new Error(`order insert: ${e6?.message}`);

  await admin.from('tenant_order_status_events').insert({
    order_id: order.id,
    from_status: null,
    to_status: 'draft',
    actor_user_id: acheteurUser.user.id,
    reason: 'created e2e',
  });

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    shopId: shop.id,
    shopSlug: shop.slug,
    adminEmail,
    adminPassword: password,
    adminUserId: adminUser.user.id,
    acheteurEmail,
    acheteurPassword: password,
    acheteurUserId: acheteurUser.user.id,
    productId: product.id,
    productName,
    orderId: order.id,
    cleanup: async () => {
      await admin.from('tenant_orders').delete().eq('id', order.id);
      await admin.from('shop_products').delete().eq('id', product.id);
      await admin.from('shops').delete().eq('id', shop.id);
      await admin.from('tenant_members').delete().eq('tenant_id', tenant.id);
      await admin.from('tenants').delete().eq('id', tenant.id);
      await admin.auth.admin.deleteUser(adminUser.user.id);
      await admin.auth.admin.deleteUser(acheteurUser.user.id);
    },
  };
}

export async function loginSession(email: string, password: string): Promise<AuthSession> {
  return getSessionForCredentials(email, password);
}
