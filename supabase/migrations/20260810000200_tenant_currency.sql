-- Refacto multi-devise — TRANCHE 1 : la devise existe.
--
-- Decision Arnaud Mazon 2026-08-10 (plan `docs/REFACTO_MULTI_DEVISE.md`) :
-- chaque imprimeur doit pouvoir travailler dans SA devise. Sans cela la
-- solution ne peut pas voyager hors zone euro.
--
-- Invariant #1 du plan : la devise appartient a l'imprimeur (tenant), pas au
-- produit, pas a l'ecran, pas au composant. Un devis, une boutique, un
-- catalogue heritent de la devise de leur imprimeur.
--
-- Avant : 103 occurrences d'euro cable en dur dans `src/`, devise absente de
-- `tenants` (elle n'existait que sur `orders.currency`).
-- Apres : `tenants.currency` porte la devise, consommee par `getCurrency()`
-- dans `src/app/utils/currency.ts`.
--
-- Defaut 'EUR' pour ne rien casser sur les tenants existants.
-- Aucune conversion de taux de change : hors perimetre V1 (invariant #4).

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'EUR';

COMMENT ON COLUMN public.tenants.currency IS
  'Devise de travail du tenant, code ISO 4217 alpha-3 majuscule. Consomme par getCurrency() dans src/app/utils/currency.ts. Pas de conversion de change : un devis est mono-devise.';

-- Garde-fou : code ISO 4217 alpha-3 en majuscules. Empeche 'eur', '€', 'EURO'.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_currency_iso4217'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_currency_iso4217
      CHECK (currency ~ '^[A-Z]{3}$');
  END IF;
END$$;

-- ─── Devise d'une boutique publique ─────────────────────────────────────────
-- La RLS `tenants_select` reserve la lecture de `tenants` aux membres. Un
-- visiteur anonyme d'une boutique publique (`/shop/:slug`) ne peut donc pas
-- lire la devise de l'imprimeur — il verrait des euros meme chez un imprimeur
-- en dollars, ce qui viderait la tranche 1 de son sens cote vitrine.
--
-- Cette fonction SECURITY DEFINER expose UNIQUEMENT le code devise d'une
-- boutique active, rien d'autre. Aucune donnee tenant ne fuit.
CREATE OR REPLACE FUNCTION public.shop_currency(p_slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.currency
  FROM public.shops s
  JOIN public.tenants t ON t.id = s.tenant_id
  WHERE s.slug = p_slug
    AND s.active = true
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.shop_currency(text) IS
  'Devise de l''imprimeur proprietaire d''une boutique active, par slug. SECURITY DEFINER volontaire : contourne la RLS tenants pour le visiteur anonyme, en n''exposant que le code ISO 4217.';

REVOKE ALL ON FUNCTION public.shop_currency(text) FROM public;
GRANT EXECUTE ON FUNCTION public.shop_currency(text) TO anon, authenticated;
