-- S-CAT (ADR-4.17) — Gamme racine "Packaging / Emballage".
-- Decision Arnaud 2026-07-07 : le packaging couvre tout ce qui releve d une
-- production a base de carton ou materiaux d emballage. Famille standard du
-- secteur (Exaprint/Vistaprint : Packaging & Emballage), absente jusqu ici.
--
-- matching_rules : repli pour la resolution par regles (la categorie explicite
-- gamme_slug prime de toute facon). display_order 90 = apres les familles plates.

INSERT INTO public.product_gammes (slug, name, parent_slug, matching_rules, display_order)
VALUES (
  'packaging',
  'Packaging / Emballage',
  NULL,
  '{"kind": ["packaging", "boite", "emballage", "carton", "etui", "coffret", "pochette"]}'::jsonb,
  90
)
ON CONFLICT (slug) DO NOTHING;
