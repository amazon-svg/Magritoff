-- =============================================================================
-- Fix RLS — product_library lecture publique via shop actif
-- -----------------------------------------------------------------------------
-- BUG : les produits assignes a une bibliotheque puis exposes dans une
-- boutique (shops.library_ids) n'apparaissent PAS cote acheteur.
--
-- CAUSE : product_library n'avait qu'une policy select tenant-scoped
--   (product_library_select : tenant_id in current_user_tenant_ids()).
--   Le front PublicShop.tsx lit product_library en direct
--   (.in('library_id', libraryIds).eq('active', true)), mais un acheteur
--   anonyme / d'un autre tenant / compte shop_only ne matche jamais le
--   tenant -> la requete renvoie 0 ligne silencieusement.
--   L'admin de la boutique (meme tenant) les voyait bien dans le BO, d'ou
--   l'effet "ca marche chez moi mais pas dans la boutique".
--
-- FIX : ajouter une policy de lecture PUBLIQUE calquee sur
--   shop_products_public_read (20260424000400_rls_tenant_scoped.sql:177-183) :
--   un produit est lisible si sa bibliotheque est referencee (library_ids)
--   par au moins une boutique active. Surface minimale : le produit doit
--   lui-meme etre actif. Aucun changement cote code front.
-- =============================================================================

alter table if exists public.product_library enable row level security;

drop policy if exists "product_library_public_read" on public.product_library;

create policy "product_library_public_read" on public.product_library for select using (
  active = true
  and exists (
    select 1 from public.shops s
    where s.active = true
      and product_library.library_id = any (s.library_ids)
  )
);

notify pgrst, 'reload schema';
