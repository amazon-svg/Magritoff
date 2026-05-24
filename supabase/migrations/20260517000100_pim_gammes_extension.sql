-- ============================================================================
-- Migration : extension du catalogue de gammes PIM (Story P0.2 Sprint 4)
-- Date      : 2026-05-17
-- Rationale : 5 gammes manquantes detectees via audit 2026-05-17 (codes
--             discriminateurs presents dans src/app/utils/productEnrichment.ts
--             et PRD mockup MVP/Growth mais sans entree product_gammes).
--             Sans ces gammes, resolveGamme() retournait null pour les
--             kakemonos/etiquettes/banderoles -> badge "LEAFLET" generique
--             affiche sur la card boutique au lieu du libelle metier.
--
-- Convention matching_rules (cf. header 20260420_pim.sql lignes 80-88) :
--   kind       : "leaflet" | "folded" | "book"
--   size_range : { min_dim?, max_dim? }   -- borne sur max(width, height) en mm
--   size_near  : { width, height, tol }   -- match precis +- tol mm
--   binding_in : string[]                 -- pour kind=book
--   folds      : string                   -- pour kind=folded
--
-- Idempotence : ON CONFLICT (slug) DO UPDATE => safe a re-jouer.
-- ============================================================================

insert into public.product_gammes (slug, name, parent_slug, display_order, matching_rules) values
  -- Kakemonos / Roll-ups : leaflet vertical grand format (min_dim >= 1500mm).
  -- Discriminateur present dans productEnrichment.ts (lignes 97-106).
  ('kakemono', 'Kakémonos / Roll-ups', null, 35,
    '{"kind":"leaflet","size_range":{"min_dim":1500}}'),
  ('roll_up_80x200', 'Roll-up standard 80×200 cm', 'kakemono', 36,
    '{"kind":"leaflet","size_near":{"width":800,"height":2000,"tol":50}}'),

  -- Etiquettes / Stickers : leaflet petit format (max_dim <= 100mm).
  -- Discriminateur present dans productEnrichment.ts + PRD MVP mockup cible.
  ('etiquette', 'Étiquettes / Stickers', null, 37,
    '{"kind":"leaflet","size_range":{"max_dim":100}}'),

  -- Banderoles : leaflet grand format intermediaire (1000-1500mm), entre
  -- affiche A0 (max ~1189) et kakemono (min 1500). Souvent imprime sur bache
  -- PVC chez Clariprint, kind=leaflet par defaut MVP.
  ('banderole', 'Banderoles', null, 38,
    '{"kind":"leaflet","size_range":{"min_dim":1000,"max_dim":1500}}'),

  -- Depliant plie DL (sous-gamme depliant existante) : 3 volets format DL 210x100.
  ('depliant_plie_dl', 'Dépliant plié DL (3 volets)', 'depliant', 41,
    '{"kind":"folded","size_near":{"width":210,"height":100,"tol":5}}')

on conflict (slug) do update set
  name = excluded.name,
  parent_slug = excluded.parent_slug,
  display_order = excluded.display_order,
  matching_rules = excluded.matching_rules;

-- ============================================================================
-- Smoke check : doit retourner 5 lignes (nouvelles gammes) + 22 lignes (legacy)
-- = 27 total apres application.
-- ============================================================================
-- select count(*) from public.product_gammes;  -- attendu : 27
-- select slug, name, parent_slug, display_order
--   from public.product_gammes
--   where slug in ('kakemono','roll_up_80x200','etiquette','banderole','depliant_plie_dl')
--   order by display_order;
