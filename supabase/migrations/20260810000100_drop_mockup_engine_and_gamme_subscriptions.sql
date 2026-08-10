-- =============================================================================
-- REFACTO-VISUELS (2026-08-10) — nettoyage : moteur SVG + souscriptions gammes
-- -----------------------------------------------------------------------------
-- Arbitrage Arnaud du 2026-08-10, faisant suite a la refonte du 2026-08-09
-- (migration `20260809000100_gamme_visuals.sql`).
--
-- ⚠️ MIGRATION DESTRUCTIVE ET IRREVERSIBLE. Elle supprime des donnees, pas
-- seulement des objets de schema. Lire les deux sections avant de la jouer.
--
-- =============================================================================
-- 1. Bucket `product_mockups` — cache du moteur SVG
-- -----------------------------------------------------------------------------
-- Contenu : PNG generes par l'edge function `mockup-generator` (supprimee du
-- depot dans le meme commit), caches sous <tenant>/<shop>/<product>_v7.png.
-- Plus aucun code ne les lit depuis P18 v2 (2026-06-24) : la boutique servait
-- des visuels statiques, puis, depuis le 2026-08-09, le visuel de la gamme PIM.
--
-- ⚠️ NE PAS CONFONDRE avec le bucket `shop_product_mockups` (souligne : nom
-- DIFFERENT), qui porte les visuels TELEVERSES par les boutiques via l'ecran
-- « Mockups custom ». Celui-la est une fonction vivante et prioritaire sur la
-- resolution PIM : il n'est pas touche ici.
--
-- Les objets doivent partir avant le bucket (contrainte de cle etrangere
-- storage.objects.bucket_id -> storage.buckets.id).
-- =============================================================================

delete from storage.objects where bucket_id = 'product_mockups';

drop policy if exists "product_mockups_public_read" on storage.objects;

delete from storage.buckets where id = 'product_mockups';

-- =============================================================================
-- 2. Table `tenant_gamme_subscriptions` — souscriptions de gammes par tenant
-- -----------------------------------------------------------------------------
-- Alimentee par l'ecran « Gammes actives » et par l'etape 2 du wizard de
-- creation d'espace (E9.6), tous deux supprimes le 2026-08-09.
--
-- Ce qu'elle faisait REELLEMENT, et pourquoi elle part : elle ne decidait pas
-- des produits vendus — ca, c'est `shops.library_ids`, `shops.pim_catalog_mode`
-- et `shops.pim_gamme_slugs`. Elle ne filtrait que le MENU de la boutique, en
-- doublon avec la selection de gammes par boutique : le menu pouvait donc
-- promettre une gamme vide, ou taire une gamme effectivement vendue. Le menu
-- derive desormais du catalogue reel de la boutique.
--
-- Chaine canonique retenue : PIM -> bibliotheque -> boutique.
--
-- `cascade` emporte les policies RLS et les contraintes qui en dependent.
-- Aucune autre table n'y fait reference (verifie : aucune FK entrante).
-- =============================================================================

drop table if exists public.tenant_gamme_subscriptions cascade;

notify pgrst, 'reload schema';
