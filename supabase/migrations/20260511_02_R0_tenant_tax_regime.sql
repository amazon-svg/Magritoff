-- R0 - Spike H : TVA configurable par tenant.
--
-- Ajoute une colonne tax_regime sur la table tenants pour permettre une TVA
-- adaptee au regime fiscal du tenant (metropole FR, DOM-TOM, franchise TVA,
-- export UE, export hors UE).
--
-- Avant : TVA hardcodee 20 % dans 22+ endroits du code (audit refacto 2026-05-11
-- bug critique B1). Maintenant : helper getTaxRate(tenant) centralise le calcul.
--
-- Defaut metropole_fr (20 %) pour ne rien casser sur les tenants existants.

DO $$
BEGIN
  -- Creer l'enum tax_regime si pas deja present (idempotent)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_regime_enum') THEN
    CREATE TYPE tax_regime_enum AS ENUM (
      'metropole_fr',   -- TVA standard 20 %
      'dom_tom',        -- TVA reduite 8.5 % (Reunion, Martinique, Guadeloupe)
      'franchise_tva',  -- TVA non applicable art. 293 B CGI (auto-entrepreneur)
      'export_eu',      -- Export UE : autoliquidation par l'acheteur, 0 %
      'export_world'    -- Export hors UE : exoneration, 0 %
    );
  END IF;
END$$;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS tax_regime tax_regime_enum
    NOT NULL DEFAULT 'metropole_fr';

COMMENT ON COLUMN tenants.tax_regime IS
  'Regime fiscal TVA du tenant. Consomme par getTaxRate() dans src/app/utils/tax.ts.';
