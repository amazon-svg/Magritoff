-- =============================================================================
-- Migration 07 / v3 — Ajout colonnes image_url sur product_gammes + product_definitions
-- -----------------------------------------------------------------------------
-- Encore un oubli du bootstrap SQL v2 : l'editeur Admin PIM reference
-- gamme.image_url et definition.image_url, et le resolveur d'image cote
-- frontend (resolveProductImage) en depend aussi. Sans ces colonnes, les
-- upserts depuis l'UI echouent silencieusement et le fallback ProductMockup
-- SVG s'affiche partout.
--
-- Ajout des deux colonnes + notify PostgREST pour rafraichir le cache.
-- =============================================================================

alter table public.product_gammes
  add column if not exists image_url text default '';

alter table public.product_definitions
  add column if not exists image_url text default '';

notify pgrst, 'reload schema';
