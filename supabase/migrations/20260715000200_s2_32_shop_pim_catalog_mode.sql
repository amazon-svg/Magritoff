-- =============================================================================
-- S2.32 — Mode "Catalogue PIM complet" au niveau boutique
-- -----------------------------------------------------------------------------
-- Ajoute deux axes d'exposition sur shops, orthogonaux a library_ids :
--   - pim_catalog_mode : ON = la boutique expose le catalogue PIM du tenant
--   - pim_gamme_slugs   : gammes explicitement incluses en mode PIM
--
-- "Tout le PIM" (radio BO) = pim_catalog_mode true + pim_gamme_slugs = toutes
-- les gammes recensees (tenant_gamme_subscriptions) a l'instant du clic.
-- Decocher une gamme retire son slug. Mode ON + tableau vide = rien expose.
--
-- Etend product_library_public_read (creee par le hotfix
-- 20260715000100) pour couvrir la voie PIM en plus de la voie library_ids.
-- Le mode PIM n'expose QUE les produits du meme tenant que le shop et actifs.
-- =============================================================================

alter table if exists public.shops
  add column if not exists pim_catalog_mode boolean not null default false;

alter table if exists public.shops
  add column if not exists pim_gamme_slugs text[] not null default '{}'::text[];

-- Policy de lecture publique etendue (remplace la version hotfix)
drop policy if exists "product_library_public_read" on public.product_library;

create policy "product_library_public_read" on public.product_library for select using (
  active = true
  and exists (
    select 1 from public.shops s
    where s.active = true
      and (
        product_library.library_id = any (s.library_ids)
        or (
          s.pim_catalog_mode = true
          and s.tenant_id = product_library.tenant_id
          and product_library.gamme_slug = any (s.pim_gamme_slugs)
        )
      )
  )
);

notify pgrst, 'reload schema';
