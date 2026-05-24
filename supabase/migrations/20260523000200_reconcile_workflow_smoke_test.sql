-- =============================================================================
-- Smoke test post S-RECONCILE-SUPABASE-MIGRATIONS (2026-05-23).
-- Migration triviale (no-op fonctionnel) pour valider que le workflow
-- supabase db push --linked fonctionne nativement apres la reconciliation
-- des 29 migrations historiques.
--
-- Effet : juste un COMMENT ON sur la table tenant_orders (metadata, pas
-- de schema change reel).
--
-- Apres execution prod via `supabase db push --linked`, on doit voir une
-- nouvelle entree dans supabase_migrations.schema_migrations sans avoir
-- a la marquer manuellement.
-- =============================================================================

comment on table public.tenant_orders is
  'Commandes acheteur B2B (v1.1). Reconciliee 2026-05-23 (S-RECONCILE).';
