-- =============================================================================
-- A4.1 — Personnalisation boutique : bannière hero + tagline
-- -----------------------------------------------------------------------------
-- Ajoute deux colonnes optionnelles sur `shops` :
--   - hero_image_url : URL image affichée en tête de la boutique publique
--   - tagline        : phrase courte affichée en overlay du hero (max 120
--                      caractères, contrainte UI côté DashboardShopEditor)
--
-- Politiques RLS existantes sur `shops` s'appliquent automatiquement aux
-- nouvelles colonnes (lecture/écriture tenant-scoped, lecture publique
-- anonyme pour les boutiques `active=true`).
--
-- Migration idempotente (add column if not exists).
-- =============================================================================

alter table public.shops
  add column if not exists hero_image_url text,
  add column if not exists tagline text;

-- Force PostgREST à rafraîchir son cache de schéma pour éviter les erreurs
-- "Could not find column ... in schema cache" jusqu'au prochain redeploy.
notify pgrst, 'reload schema';
