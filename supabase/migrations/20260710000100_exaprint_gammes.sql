-- =============================================================================
-- S-PIM-EXAPRINT-1 (2026-07-10) — Extension de l'arbre des gammes PIM
-- Référentiel catalogue « cœur imprimeur » aligné sur les gammes du marché
-- (réf. Exaprint/Vistaprint, ADR-4.17). 16 familles racines, 81 gammes.
--
-- Politique matching_rules (ADR-4.17) : le gamme_slug explicite PRIME toujours.
-- Les nouvelles gammes ambiguës reçoivent {} (= jamais matchées par résolution
-- dimensionnelle, atteignables uniquement par slug explicite) pour ne créer
-- AUCUN faux positif sur les produits historiques.
-- =============================================================================
BEGIN;

-- ─── Renumérotation des gammes existantes (plages par centaines) ───
UPDATE public.product_gammes SET display_order = 100 WHERE slug = 'carterie';
UPDATE public.product_gammes SET display_order = 101 WHERE slug = 'carte_visite_standard';
UPDATE public.product_gammes SET display_order = 102 WHERE slug = 'carte_visite_horizontale';
UPDATE public.product_gammes SET display_order = 103 WHERE slug = 'carte_visite_carree';
UPDATE public.product_gammes SET display_order = 104 WHERE slug = 'carte_correspondance';
UPDATE public.product_gammes SET display_order = 105 WHERE slug = 'carte_voeux';
UPDATE public.product_gammes SET display_order = 120 WHERE slug = 'flyer';
UPDATE public.product_gammes SET display_order = 122 WHERE slug = 'flyer_a6';
UPDATE public.product_gammes SET display_order = 123 WHERE slug = 'flyer_a5';
UPDATE public.product_gammes SET display_order = 124 WHERE slug = 'flyer_dl';
UPDATE public.product_gammes SET display_order = 125 WHERE slug = 'flyer_a4';
UPDATE public.product_gammes SET display_order = 140 WHERE slug = 'depliant';
UPDATE public.product_gammes SET display_order = 141 WHERE slug = 'depliant_plie_dl';
UPDATE public.product_gammes SET display_order = 160 WHERE slug = 'brochure';
UPDATE public.product_gammes SET display_order = 161 WHERE slug = 'brochure_piquee';
UPDATE public.product_gammes SET display_order = 162 WHERE slug = 'brochure_dos_carre';
UPDATE public.product_gammes SET display_order = 163 WHERE slug = 'brochure_spirale';
UPDATE public.product_gammes SET display_order = 164 WHERE slug = 'brochure_cousue';
UPDATE public.product_gammes SET display_order = 180 WHERE slug = 'affiche';
UPDATE public.product_gammes SET display_order = 181 WHERE slug = 'affiche_a3';
UPDATE public.product_gammes SET display_order = 182 WHERE slug = 'affiche_a2';
UPDATE public.product_gammes SET display_order = 184 WHERE slug = 'affiche_a1';
UPDATE public.product_gammes SET display_order = 185 WHERE slug = 'affiche_a0';
UPDATE public.product_gammes SET display_order = 200 WHERE slug = 'kakemono';
UPDATE public.product_gammes SET display_order = 201 WHERE slug = 'roll_up_80x200';
UPDATE public.product_gammes SET display_order = 240, name = 'Banderoles / Bâches' WHERE slug = 'banderole';
UPDATE public.product_gammes SET display_order = 320 WHERE slug = 'etiquette';
UPDATE public.product_gammes SET display_order = 400 WHERE slug = 'packaging';

-- ─── Nouvelles gammes ───
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('carte_postale', 'Carte postale', 'carterie', 106, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('carton_invitation', 'Carton d''invitation / Faire-part', 'carterie', 107, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('flyer_a7', 'Flyer A7', 'flyer', 121, '{"kind": "leaflet", "size_near": {"tol": 3, "width": 74, "height": 105}}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('flyer_carre', 'Flyer carré', 'flyer', 126, '{"kind": "leaflet", "size_near": {"tol": 5, "width": 148, "height": 148}}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('depliant_2_volets', 'Dépliant 2 volets', 'depliant', 142, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('depliant_accordeon', 'Dépliant accordéon', 'depliant', 143, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('affiche_40x60', 'Affiche 40×60 cm', 'affiche', 183, '{"kind": "leaflet", "size_near": {"tol": 10, "width": 400, "height": 600}}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('affiche_abribus', 'Affiche abribus 120×176 cm', 'affiche', 186, '{"kind": "leaflet", "size_near": {"tol": 20, "width": 1200, "height": 1760}}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('affiche_dos_bleu', 'Affiche dos bleu', 'affiche', 187, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('roll_up_100x200', 'Roll-up 100×200 cm', 'kakemono', 202, '{"kind": "leaflet", "size_near": {"tol": 50, "width": 1000, "height": 2000}}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('roll_up_120x200', 'Roll-up 120×200 cm', 'kakemono', 203, '{"kind": "leaflet", "size_near": {"tol": 50, "width": 1200, "height": 2000}}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('x_banner', 'X-banner', 'kakemono', 204, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('drapeau', 'Drapeaux / Beach flags', null, 220, '{"kind": ["drapeau", "beach flag", "beachflag", "oriflamme", "voile", "flag"]}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('beach_flag', 'Beach flag / Oriflamme', 'drapeau', 221, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('drapeau_mat', 'Drapeau pour mât', 'drapeau', 222, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('bache_pvc', 'Bâche PVC', 'banderole', 241, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('banderole_microperforee', 'Bâche micro-perforée', 'banderole', 242, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('banderole_textile', 'Banderole textile', 'banderole', 243, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('panneau', 'Panneaux rigides', null, 260, '{"kind": ["panneau", "dibond", "forex", "akylux", "akilux", "plexi", "plexiglass", "alu composite", "pvc expanse"]}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('panneau_akylux', 'Panneau Akylux', 'panneau', 261, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('panneau_dibond', 'Panneau Dibond', 'panneau', 262, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('panneau_forex', 'Panneau Forex', 'panneau', 263, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('panneau_plexi', 'Plaque plexiglass', 'panneau', 264, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('adhesif', 'Adhésifs / Vitrophanie', null, 280, '{"kind": ["adhesif", "vinyle", "vitrophanie", "covering", "autocollant vitrine", "sticker vitrine"]}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('vitrophanie', 'Vitrophanie', 'adhesif', 281, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('adhesif_sol', 'Adhésif de sol', 'adhesif', 282, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('plv', 'PLV / Displays', null, 300, '{"kind": ["plv", "presentoir", "totem", "display", "stop-trottoir", "chevalet", "stand", "comptoir", "photocall"]}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('presentoir_comptoir', 'Présentoir comptoir', 'plv', 301, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('totem_carton', 'Totem carton', 'plv', 302, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('stop_trottoir', 'Stop-trottoir / Chevalet', 'plv', 303, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('stand_parapluie', 'Stand parapluie', 'plv', 304, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('etiquette_planche', 'Étiquettes en planche A4', 'etiquette', 321, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('etiquette_rouleau', 'Étiquettes en rouleau', 'etiquette', 322, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('sticker_forme', 'Sticker découpe forme', 'etiquette', 323, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('papeterie', 'Papeterie commerciale', null, 340, '{"kind": ["papeterie", "tete de lettre", "en-tete", "enveloppe", "chemise", "bloc-notes", "bloc notes", "carnet", "autocopiant", "sous-main", "marque-page"]}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('tete_lettre', 'Tête de lettre / Papier en-tête', 'papeterie', 341, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('enveloppe', 'Enveloppe personnalisée', 'papeterie', 342, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('chemise_rabats', 'Chemise à rabats', 'papeterie', 343, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('bloc_note', 'Bloc-notes', 'papeterie', 344, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('carnet_autocopiant', 'Carnet autocopiant', 'papeterie', 345, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('marque_page', 'Marque-page', 'papeterie', 346, '{"kind": "leaflet", "size_near": {"tol": 3, "width": 50, "height": 210}}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('sous_main', 'Sous-main', 'papeterie', 347, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('calendrier', 'Calendriers', null, 360, '{"kind": ["calendrier", "almanach", "ephemeride"]}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('calendrier_souple', 'Calendrier souple', 'calendrier', 361, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('calendrier_spirale', 'Calendrier mural spirale', 'calendrier', 362, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('calendrier_bancaire', 'Calendrier bancaire contrecollé', 'calendrier', 363, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('restauration', 'Menus / Restauration', null, 380, '{"kind": ["menu", "carte des vins", "set de table", "restauration"]}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('menu', 'Menu restaurant', 'restauration', 381, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('set_de_table', 'Set de table', 'restauration', 382, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('boite_pliante', 'Boîte pliante carton', 'packaging', 401, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('boite_expedition', 'Boîte d''expédition e-commerce', 'packaging', 402, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('coffret_premium', 'Coffret premium / Boîte aimantée', 'packaging', 403, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;
INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)
VALUES ('sac_papier', 'Sac papier kraft', 'packaging', 404, '{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,
  display_order = excluded.display_order, matching_rules = excluded.matching_rules;

COMMIT;

notify pgrst, 'reload schema';
