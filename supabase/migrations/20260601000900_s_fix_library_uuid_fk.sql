-- =============================================================================
-- Migration S-FIX-LIBRARY-UUID (Sprint 8, 2026-06-01)
--
-- Audit prod 01/06 :
--   - product_library : 31 rows, 100% UUID v4 valides (déjà uuid strict
--     depuis 20260418_shop_module.sql `id uuid primary key default
--     gen_random_uuid()`). Aucune migration data nécessaire.
--   - tenant_order_items : 12 rows tous avec product_id NULL (legacy
--     P0.11 ALTER COLUMN product_id NULL). Aucun orphan possible.
--
-- Reste à faire pour clore la story : ajout FK strict pour intégrité
-- référentielle. ON DELETE SET NULL cohérent avec product_id nullable
-- (si product_library row supprimé, l'item legacy garde la trace via
-- product_label snapshot, juste perd la FK).
-- =============================================================================

-- Ajout FK strict (idempotent via DO bloc qui catch duplicate_object)
do $$
begin
  alter table public.tenant_order_items
    add constraint tenant_order_items_product_id_fk
    foreign key (product_id)
    references public.product_library(id)
    on delete set null;
exception when duplicate_object then null; end $$;

-- Pas de re-NOT NULL : 12 rows legacy en prod avec product_id NULL.
-- Re-NOT NULL casserait l'historique. Cas accepté MVP, à reconsidérer
-- V2+ si la cohérence référentielle stricte devient un blocker métier.

notify pgrst, 'reload schema';
