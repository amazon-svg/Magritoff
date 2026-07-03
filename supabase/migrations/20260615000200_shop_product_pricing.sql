-- =============================================================================
-- A4.5 — Tarif négocié par boutique (override prix per-shop)
-- -----------------------------------------------------------------------------
-- Modèle MVP simple : 1 override par couple (shop, library_product).
-- Use case : "pour le client X, j'ai négocié -15% sur les brochures".
--
-- Hiérarchie de prix portail acheteur :
--   shop_pricing > library_cached > zero
--
-- L'override prime sur le prix biblio. Si pas d'override, on revient au prix
-- catalogue défini dans product_library.price_ht.
--
-- Pas de validity temporelle (valid_from/valid_until) ni de note pour MVP —
-- extensions traçables en V2 (contrats trimestriels, audit négociation).
--
-- RLS :
--   * tenant select/write : admin tenant gère les tarifs de SES boutiques
--   * public read : portail acheteur anonyme peut lire les overrides des
--                   shops actifs (sinon impossible d'afficher le prix négocié)
-- =============================================================================

create table if not exists public.shop_product_pricing (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  library_product_id uuid not null references public.product_library(id) on delete cascade,
  price_ht_override numeric(12,2) not null,
  tenant_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unicité : un seul override actif par couple (shop, library_product).
create unique index if not exists ux_shop_product_pricing_couple
  on public.shop_product_pricing (shop_id, library_product_id);

-- Index secondaires pour les lectures fréquentes (par shop côté portail
-- acheteur, par tenant côté admin).
create index if not exists ix_shop_product_pricing_shop
  on public.shop_product_pricing (shop_id);
create index if not exists ix_shop_product_pricing_tenant
  on public.shop_product_pricing (tenant_id);

-- Trigger updated_at (pattern repo : ré-utilise la fonction tg_set_updated_at
-- si elle existe, sinon on définit la maintenance manuellement côté code).
-- On reste minimaliste : pas de trigger pour MVP. Le code applicatif fera
-- l'update explicite si besoin.

alter table public.shop_product_pricing enable row level security;

-- Drop policies si re-run (idempotent)
drop policy if exists "shop_product_pricing_select_tenant" on public.shop_product_pricing;
drop policy if exists "shop_product_pricing_write" on public.shop_product_pricing;
drop policy if exists "shop_product_pricing_public_read" on public.shop_product_pricing;

-- Lecture tenant : admin tenant voit les overrides de toutes ses boutiques
create policy "shop_product_pricing_select_tenant"
  on public.shop_product_pricing
  for select using (
    is_super_admin()
    or (tenant_id in (select public.current_user_tenant_ids()))
  );

-- Écriture tenant : insert/update/delete par membres du tenant
create policy "shop_product_pricing_write"
  on public.shop_product_pricing
  for all using (
    is_super_admin()
    or (tenant_id in (select public.current_user_tenant_ids()))
  ) with check (
    is_super_admin()
    or (tenant_id in (select public.current_user_tenant_ids()))
  );

-- Lecture publique anonyme : indispensable pour que le portail acheteur
-- non authentifié (ex: prospect qui découvre la boutique) voit les bons
-- prix. Réservée aux overrides des shops actifs (mêmes conditions que
-- shop_products_public_read en migration 04).
create policy "shop_product_pricing_public_read"
  on public.shop_product_pricing
  for select using (
    exists (
      select 1 from public.shops s
      where s.id = shop_product_pricing.shop_id
        and s.active = true
    )
  );

-- Force PostgREST à rafraîchir son cache de schéma
notify pgrst, 'reload schema';
