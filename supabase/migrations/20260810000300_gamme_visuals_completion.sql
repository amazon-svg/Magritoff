-- =============================================================================
-- REFACTO-VISUELS (2026-08-10) — les 10 familles racines restantes
-- -----------------------------------------------------------------------------
-- Complete `20260809000100_gamme_visuals.sql`, qui avait couvert 6 familles
-- racines sur 16 : les 10 autres etaient volontairement SANS visuel, en
-- attendant production, plutot que de recevoir celui d'une autre famille.
--
-- Visuels produits par Gemini a partir du brief
-- `_bmad-output/planning-artifacts/brief-gemini-visuels-gammes-manquantes-2026-08-10.md`,
-- puis controles un par un contre les criteres d'acceptation du brief : chaque
-- image porte le marqueur distinctif qui rend sa famille non confondable
-- (dos carre collé, oeillets, spirale + grille de dates, tranche du panneau,
-- raclette sur le verre, cannelures du carton...).
--
-- Le visuel « brochure » retire le 2026-08-09 est REMPLACE, pas restaure :
-- l'ancien montrait un depliant plie ouvert a plat, le nouveau un livret relie
-- dos carre dont l'epaisseur et le bloc de pages sont visibles.
--
-- Apres cette migration : 16 familles racines sur 16 couvertes, et les 65
-- sous-gammes heritent par `parent_slug` (aucune sous-gamme n'est seedee).
--
-- IDEMPOTENCE. Comme la migration du 2026-08-09, on n'ecrase QUE les valeurs
-- vides : une image curee depuis l'admin PIM n'est jamais perdue si la
-- migration est rejouee.
-- =============================================================================

update public.product_gammes
   set image_url = v.url
  from (values
    ('brochure',     '/visuels-produits/magrit-brochure.jpg'),
    ('affiche',      '/visuels-produits/magrit-affiche.jpg'),
    ('banderole',    '/visuels-produits/magrit-banderole.jpg'),
    ('drapeau',      '/visuels-produits/magrit-drapeau.jpg'),
    ('panneau',      '/visuels-produits/magrit-panneau.jpg'),
    ('adhesif',      '/visuels-produits/magrit-adhesif.jpg'),
    ('plv',          '/visuels-produits/magrit-plv.jpg'),
    ('papeterie',    '/visuels-produits/magrit-papeterie.jpg'),
    ('calendrier',   '/visuels-produits/magrit-calendrier.jpg'),
    ('restauration', '/visuels-produits/magrit-restauration.jpg')
  ) as v(slug, url)
 where public.product_gammes.slug = v.slug
   and coalesce(nullif(trim(public.product_gammes.image_url), ''), null) is null;

notify pgrst, 'reload schema';
