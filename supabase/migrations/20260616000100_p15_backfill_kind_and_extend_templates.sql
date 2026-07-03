-- =============================================================================
-- P15 (2026-06-16) — Back-fill config.kind + extension templates supportes
-- -----------------------------------------------------------------------------
-- Cette migration adresse 2 problemes lies aux visuels Magrit-brandes :
--
-- 1. Bug DATA Manitou identifie 2026-06-16 : tous les products library Manitou
--    (et probablement d autres tenants) ont config.kind = NULL en DB. Resultat
--    cote front : resolveMockupTemplate tombait sur fallback "flyer" pour tous
--    -> tous le meme mockup. Cause : ingestion PIM historique n a pas rempli
--    config.kind sur les products library cree avant 2026-06.
--
--    Fix : UPDATE rétroactif des products library avec config.kind null en
--    inférant le kind depuis le nom (similar a inferTemplateFromText cote
--    front P14). Cible :
--      - "carte de visite", "cartes" -> kind = 'carte_visite'
--      - "depliant", "3 volets", "2 volets" -> kind = 'depliant' (P15 nouveau)
--      - "brochure", "catalogue", "livret", "magazine" -> kind = 'brochure'
--      - "packaging", "boite", "pochette", "emballage" -> kind = 'packaging' (P15 nouveau)
--      - "etiquette", "sticker" -> kind = 'etiquette'
--      - "roll-up", "kakemono", "banderole" -> kind = 'kakemono'
--      - "flyer", "tract", "affiche" -> kind = 'flyer'
--    Les autres restent null (rien a inferer surement) — l inference cote
--    front P14 fera le fallback.
--
-- 2. Extension shop_template_mockups CHECK constraint pour autoriser les 2
--    nouveaux templates 'packaging' et 'depliant' (sinon upload custom KO).
-- =============================================================================

-- ─── 1. Back-fill config.kind sur product_library ─────────────────────────
do $$
declare
  rec record;
  inferred text;
  patched int := 0;
begin
  for rec in
    select id, name, category, config
    from public.product_library
    where (config->>'kind') is null
      and active = true
  loop
    inferred := case
      when rec.name ilike '%packaging%' or rec.name ilike '%emballage%'
        or rec.name ilike '%pochette%' or rec.name ilike '%boite%'
        or rec.name ilike '%boîte%' or rec.name ilike '%carton%'
        then 'packaging'
      when rec.name ilike '%dépliant%' or rec.name ilike '%depliant%'
        or rec.name ilike '%3 volets%' or rec.name ilike '%2 volets%'
        or rec.name ilike '%trifold%' or rec.name ilike '%bifold%'
        then 'depliant'
      when rec.name ilike '%brochure%' or rec.name ilike '%catalogue%'
        or rec.name ilike '%livret%' or rec.name ilike '%magazine%'
        or rec.name ilike '%plaquette%'
        then 'brochure'
      when rec.name ilike '%étiquette%' or rec.name ilike '%etiquette%'
        or rec.name ilike '%sticker%' or rec.name ilike '%adhésif%'
        or rec.name ilike '%adhesif%'
        then 'etiquette'
      when rec.name ilike '%roll%up%' or rec.name ilike '%kakémono%'
        or rec.name ilike '%kakemono%' or rec.name ilike '%banderole%'
        or rec.name ilike '%bâche%' or rec.name ilike '%bache%'
        or rec.name ilike '%oriflamme%'
        then 'kakemono'
      when rec.name ilike '%carte%visite%' or rec.name ilike '%carte commerciale%'
        or rec.name ilike '%carte de correspondance%' or rec.name ilike '%cartes%'
        then 'carte_visite'
      when rec.name ilike '%flyer%' or rec.name ilike '%tract%'
        or rec.name ilike '%affiche%' or rec.name ilike '%poster%'
        then 'flyer'
      else null
    end;

    if inferred is not null then
      update public.product_library
      set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('kind', inferred)
      where id = rec.id;
      patched := patched + 1;
    end if;
  end loop;

  raise notice 'P15 back-fill : % products library mis a jour avec config.kind', patched;
end$$;

-- ─── 2. Extension CHECK constraint shop_template_mockups ─────────────────
alter table public.shop_template_mockups
  drop constraint if exists shop_template_mockups_template_type_check;

alter table public.shop_template_mockups
  add constraint shop_template_mockups_template_type_check
  check (template_type in (
    'carteVisite', 'flyer', 'brochure', 'etiquette', 'kakemono',
    'packaging', 'depliant'
  ));

notify pgrst, 'reload schema';
