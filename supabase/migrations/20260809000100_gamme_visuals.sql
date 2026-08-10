-- =============================================================================
-- REFACTO-VISUELS (2026-08-09) — le visuel est une PROPRIETE DE LA GAMME
-- -----------------------------------------------------------------------------
-- Arbitrage Arnaud du 2026-08-09.
--
-- CONSTAT. Les colonnes `product_gammes.image_url` et
-- `product_definitions.image_url` existent depuis la migration
-- `20260424000700`, mais AUCUNE migration ne les a jamais remplies — les deux
-- migrations Exaprint du 2026-07-10 (81 gammes, 82 definitions) n'y touchent
-- pas. Consequence : 100 % des produits tombaient sur le dernier maillon du
-- resolveur front, qui devinait une « famille de visuel » a partir de mots-cles
-- dans le NOM du produit puis servait un des 7 visuels Magrit pre-brandes.
-- Cette taxonomie parallele ne couvrait que 6 des 16 familles racines du PIM et
-- retombait SILENCIEUSEMENT sur « flyer » pour toutes les autres : un
-- calendrier affichait une feuille plate, une brochure un depliant.
--
-- CORRECTION. On pose les visuels la ou ils doivent vivre : sur la gamme. Le
-- front (`resolveGammeImage`) les lit et les fait HERITER le long de l'arbre —
-- une sous-gamme sans visuel prend celui de sa famille. Plus aucune inference
-- sur le nom du produit.
--
-- URLs. Chemins publics stables servis par le front (`public/visuels-produits/`,
-- copie verbatim par Vite). Un asset importe depuis `src/` aurait une URL
-- hachee au build, donc invalide en base au build suivant.
--
-- IDEMPOTENCE. On n'ecrase QUE les valeurs vides : une image deja curee depuis
-- l'admin PIM par un admin Magrit n'est jamais perdue si la migration est
-- rejouee.
--
-- COUVERTURE ASSUMEE : 6 familles racines sur 16. Les 10 autres (brochure,
-- affiche, banderole, drapeau, panneau, adhesif, plv, papeterie, calendrier,
-- restauration) restent SANS visuel volontairement — le front affiche alors le
-- repere de famille (pictogramme + tonalite). Un visuel faux est pire qu'une
-- absence de visuel. Le visuel « brochure » historique n'est pas reconduit :
-- il montrait un depliant plie ouvert a plat, pas un livret relie.
-- =============================================================================

update public.product_gammes
   set image_url = v.url
  from (values
    ('carterie',   '/visuels-produits/magrit-carte-visite.jpg'),
    ('flyer',      '/visuels-produits/magrit-flyer.jpg'),
    ('depliant',   '/visuels-produits/magrit-depliant.jpg'),
    ('etiquette',  '/visuels-produits/magrit-etiquette.jpg'),
    ('kakemono',   '/visuels-produits/magrit-kakemono.jpg'),
    ('packaging',  '/visuels-produits/magrit-packaging.jpg')
  ) as v(slug, url)
 where public.product_gammes.slug = v.slug
   and coalesce(nullif(trim(public.product_gammes.image_url), ''), null) is null;

-- Les sous-gammes ne sont PAS seedees : elles heritent de leur famille par
-- remontee `parent_slug`. On ne pose une image sur une sous-gamme que pour
-- s'ecarter volontairement du visuel de sa famille.

notify pgrst, 'reload schema';
