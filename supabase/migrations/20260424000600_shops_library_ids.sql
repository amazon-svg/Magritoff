-- =============================================================================
-- Migration 06 / v3 — Ajout colonne library_ids sur shops
-- -----------------------------------------------------------------------------
-- Oublie dans le bootstrap SQL initial : la colonne existait sur v2 (ajoutee
-- via l'UI Supabase a l'epoque) et le frontend s'attend a la trouver.
--
-- Role : liste des ids de bibliotheques liees a la boutique. L'admin de la
-- boutique coche quelles libraries il veut exposer ; le front charge les
-- produits de ces libraries comme contenu de la boutique.
-- =============================================================================

alter table public.shops
  add column if not exists library_ids uuid[] not null default '{}'::uuid[];

-- Force PostgREST a rafraichir son cache de schema (sinon l'erreur
-- "Could not find the 'library_ids' column of 'shops' in the schema cache"
-- continue jusqu'au prochain redeploy).
notify pgrst, 'reload schema';
