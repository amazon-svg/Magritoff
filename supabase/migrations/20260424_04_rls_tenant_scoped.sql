-- =============================================================================
-- Migration 04 / v3 — Refonte RLS tenant-scoped
-- -----------------------------------------------------------------------------
-- Toutes les tables data passent du modele "auth.uid() = user_id" au modele
-- "tenant_id in (current_user_tenant_ids)". Le super-admin voit tout.
--
-- Les policies sont reecrites de maniere exhaustive (drop + recreate) pour
-- ne laisser aucune trace des anciennes policies user-scoped.
--
-- Tables concernees :
--   * conversations
--   * clients
--   * libraries
--   * product_library
--   * shops            + politique publique inchangee (lecture anonyme via slug)
--   * shop_products    + politique publique inchangee
--   * quotes
--   * quote_templates
--   * user_preferences → reste user-scoped (preferences personnelles)
--
-- product_gammes / product_definitions : lecture publique (patrimoine),
-- ecriture reservee aux superadmins Magrit.
-- =============================================================================

-- ─── helpers ───────────────────────────────────────────────────────────────
-- (current_user_tenant_ids, is_super_admin, user_role_in_tenant sont definis
--  en migration 01)

-- =============================================================================
-- ─── conversations ─────────────────────────────────────────────────────────
-- =============================================================================
alter table if exists public.conversations enable row level security;

drop policy if exists "conv_select_own" on public.conversations;
drop policy if exists "conv_insert_own" on public.conversations;
drop policy if exists "conv_update_own" on public.conversations;
drop policy if exists "conv_delete_own" on public.conversations;
drop policy if exists "conversations_select" on public.conversations;
drop policy if exists "conversations_insert" on public.conversations;
drop policy if exists "conversations_update" on public.conversations;
drop policy if exists "conversations_delete" on public.conversations;

create policy "conversations_select" on public.conversations for select using (
  is_super_admin()
  or (tenant_id is not null and tenant_id in (select public.current_user_tenant_ids()))
);
create policy "conversations_insert" on public.conversations for insert with check (
  tenant_id in (select public.current_user_tenant_ids())
  and user_id = auth.uid()
);
create policy "conversations_update" on public.conversations for update using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()) and user_id = auth.uid())
);
create policy "conversations_delete" on public.conversations for delete using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()) and user_id = auth.uid())
);

-- =============================================================================
-- ─── clients (CRM) ─────────────────────────────────────────────────────────
-- =============================================================================
alter table if exists public.clients enable row level security;

drop policy if exists "clients_select_own" on public.clients;
drop policy if exists "clients_insert_own" on public.clients;
drop policy if exists "clients_update_own" on public.clients;
drop policy if exists "clients_delete_own" on public.clients;
drop policy if exists "clients_select" on public.clients;
drop policy if exists "clients_write" on public.clients;

create policy "clients_select" on public.clients for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
create policy "clients_write" on public.clients for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

-- =============================================================================
-- ─── libraries + product_library ───────────────────────────────────────────
-- =============================================================================
alter table if exists public.libraries enable row level security;
alter table if exists public.product_library enable row level security;

drop policy if exists "libraries_select_own" on public.libraries;
drop policy if exists "libraries_insert_own" on public.libraries;
drop policy if exists "libraries_update_own" on public.libraries;
drop policy if exists "libraries_delete_own" on public.libraries;
drop policy if exists "libraries_select" on public.libraries;
drop policy if exists "libraries_write" on public.libraries;

create policy "libraries_select" on public.libraries for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
create policy "libraries_write" on public.libraries for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

drop policy if exists "product_library_select_own" on public.product_library;
drop policy if exists "product_library_insert_own" on public.product_library;
drop policy if exists "product_library_update_own" on public.product_library;
drop policy if exists "product_library_delete_own" on public.product_library;
drop policy if exists "product_library_select" on public.product_library;
drop policy if exists "product_library_write" on public.product_library;

create policy "product_library_select" on public.product_library for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
create policy "product_library_write" on public.product_library for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

-- =============================================================================
-- ─── shops + shop_products ─────────────────────────────────────────────────
-- =============================================================================
-- Double lecture : (a) acces tenant pour l'admin de la boutique ;
-- (b) lecture publique anonyme via slug pour /shop/:slug.
alter table if exists public.shops enable row level security;
alter table if exists public.shop_products enable row level security;

drop policy if exists "shops_select_public" on public.shops;
drop policy if exists "shops_select_own" on public.shops;
drop policy if exists "shops_insert_own" on public.shops;
drop policy if exists "shops_update_own" on public.shops;
drop policy if exists "shops_delete_own" on public.shops;
drop policy if exists "shops_select_tenant" on public.shops;
drop policy if exists "shops_public_read" on public.shops;
drop policy if exists "shops_write" on public.shops;

-- (a) acces tenant pour gerer sa boutique
create policy "shops_select_tenant" on public.shops for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
-- (b) lecture publique : tout le monde peut lire les boutiques "published"
create policy "shops_public_read" on public.shops for select using (
  status = 'published' or status = 'active'
);
create policy "shops_write" on public.shops for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

drop policy if exists "shop_products_select_public" on public.shop_products;
drop policy if exists "shop_products_select_own" on public.shop_products;
drop policy if exists "shop_products_insert_own" on public.shop_products;
drop policy if exists "shop_products_update_own" on public.shop_products;
drop policy if exists "shop_products_delete_own" on public.shop_products;
drop policy if exists "shop_products_select_tenant" on public.shop_products;
drop policy if exists "shop_products_public_read" on public.shop_products;
drop policy if exists "shop_products_write" on public.shop_products;

create policy "shop_products_select_tenant" on public.shop_products for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
-- Lecture publique des produits des shops publies
create policy "shop_products_public_read" on public.shop_products for select using (
  exists (
    select 1 from public.shops s
    where s.id = shop_products.shop_id
      and (s.status = 'published' or s.status = 'active')
  )
);
create policy "shop_products_write" on public.shop_products for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

-- =============================================================================
-- ─── quotes + quote_templates ──────────────────────────────────────────────
-- =============================================================================
alter table if exists public.quotes enable row level security;
alter table if exists public.quote_templates enable row level security;

drop policy if exists "quotes_select_own" on public.quotes;
drop policy if exists "quotes_insert_own" on public.quotes;
drop policy if exists "quotes_update_own" on public.quotes;
drop policy if exists "quotes_delete_own" on public.quotes;
drop policy if exists "quotes_select" on public.quotes;
drop policy if exists "quotes_write" on public.quotes;

create policy "quotes_select" on public.quotes for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
create policy "quotes_write" on public.quotes for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

drop policy if exists "quote_templates_select_own" on public.quote_templates;
drop policy if exists "quote_templates_insert_own" on public.quote_templates;
drop policy if exists "quote_templates_update_own" on public.quote_templates;
drop policy if exists "quote_templates_delete_own" on public.quote_templates;
drop policy if exists "quote_templates_select" on public.quote_templates;
drop policy if exists "quote_templates_write" on public.quote_templates;

create policy "quote_templates_select" on public.quote_templates for select using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);
create policy "quote_templates_write" on public.quote_templates for all using (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
) with check (
  is_super_admin()
  or (tenant_id in (select public.current_user_tenant_ids()))
);

-- =============================================================================
-- ─── user_preferences : reste user-scoped (preferences personnelles) ───────
-- =============================================================================
alter table if exists public.user_preferences enable row level security;

drop policy if exists "user_pref_select_own" on public.user_preferences;
drop policy if exists "user_pref_insert_own" on public.user_preferences;
drop policy if exists "user_pref_update_own" on public.user_preferences;

create policy "user_pref_select_own" on public.user_preferences for select using (
  is_super_admin() or auth.uid() = user_id
);
create policy "user_pref_insert_own" on public.user_preferences for insert with check (
  auth.uid() = user_id
);
create policy "user_pref_update_own" on public.user_preferences for update using (
  auth.uid() = user_id
) with check (
  auth.uid() = user_id
);

-- =============================================================================
-- ─── product_gammes + product_definitions : patrimoine Magrit ──────────────
-- =============================================================================
-- Lecture : toute personne authentifiee (les tenants filtrent cote app via
-- tenant_active_gammes). Ecriture : superadmin uniquement (admin PIM Magrit).

alter table if exists public.product_gammes enable row level security;
alter table if exists public.product_definitions enable row level security;

drop policy if exists "product_gammes_read" on public.product_gammes;
drop policy if exists "product_gammes_admin" on public.product_gammes;
drop policy if exists "product_definitions_read" on public.product_definitions;
drop policy if exists "product_definitions_admin" on public.product_definitions;

create policy "product_gammes_read" on public.product_gammes for select using (
  auth.uid() is not null
);
create policy "product_gammes_admin" on public.product_gammes for all using (
  is_super_admin()
) with check (
  is_super_admin()
);

create policy "product_definitions_read" on public.product_definitions for select using (
  auth.uid() is not null
);
create policy "product_definitions_admin" on public.product_definitions for all using (
  is_super_admin()
) with check (
  is_super_admin()
);
