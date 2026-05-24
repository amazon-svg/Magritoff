-- =============================================================================
-- Migration 09 / v3 — shops.excluded_product_ids
-- -----------------------------------------------------------------------------
-- Supporte le nouveau mecanisme de gestion produit dans une boutique :
--   - Une boutique est associee a une (ou plusieurs) bibliotheques via
--     shops.library_ids
--   - Tous les produits de ces bibliotheques apparaissent automatiquement
--     dans la boutique
--   - SI l'admin retire un produit de la boutique mais choisit de le
--     conserver dans la bibliotheque, l'id du produit est push dans
--     shops.excluded_product_ids. Le PublicShop filtre ces ids en lecture.
--
-- Avant ce fix, il y avait deux voies redondantes :
--   - bibliotheques liees (library_ids)
--   - import bulk (cree des shop_products dedupliques)
-- On unifie autour du premier mecanisme uniquement.
-- =============================================================================

alter table public.shops
  add column if not exists excluded_product_ids uuid[] not null default '{}'::uuid[];

notify pgrst, 'reload schema';
