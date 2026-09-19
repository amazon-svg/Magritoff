-- ============================================================================
-- Lot "parametre de validite des devis" (arbitrage Arnaud du 2026-09-19 --
-- Q18, docs/api/CONVENTIONS.md §8.25 point 13 (3) et ligne Q18 du point 9).
-- Verbatim d Arnaud : « Le temps de validite d un devis doit etre un
-- parametre que l on peut modifier, considerant une valeur par defaut qui
-- doit etre aussi un parametre dans le menu devis », puis « valeur par
-- defaut pour un devis 30 jours ».
--
-- Ce que cette migration livre, et RIEN d autre : 30 devient la valeur
-- LIVREE de `commercial_settings.default_validity_days`, au lieu de rester a
-- `null` indefiniment. La colonne, ses bornes (`check (... between 1 and
-- 3650)`) et son exposition au contrat (`PATCH /commercial-settings`,
-- `minimum: 1`/`maximum: 3650`) existent deja depuis E10.10a
-- (20260906160000_gescom_e10_10a_send_duplicate_global_discount.sql) --
-- aucune ligne de contrat, aucun endpoint, aucune borne nouvelle ici.
--
-- Deux effets, dans ce seul fichier :
--
--   1. DEFAUT DE COLONNE. Tout nouvel espace amorce par
--      `api_get_commercial_settings` (qui `insert ... (tenant_id) values
--      (p_tenant_id)` a la premiere lecture, sans jamais nommer
--      `default_validity_days`) recoit desormais 30 sans qu aucun code
--      applicatif n ecrive cette valeur.
--
--   2. RETROFIT DES ESPACES DEJA CREES A `null`. Choix explicite d Arnaud,
--      dans ses mots : « oui », parce qu un espace sans duree par defaut n a
--      aucun comportement defini aujourd hui -- `resolve_quote_default_
--      valid_until()` (20260909050000) renvoie `null` tant que
--      `default_validity_days` est `null`, donc AUCUN devis n a jamais recu
--      de date de cette colonne pour un tel espace : personne ne depend de
--      ce `null`. Ce choix ecarte explicitement la reserve posee par
--      E10.10a elle-meme ("la facade n invente pas 30 jours a la place d une
--      decision commerciale que personne n a prise") -- cette decision a
--      maintenant ete prise, par Arnaud, le 2026-09-19.
--
--      Mesure sur la base LOCALE avant cette migration (docker
--      supabase_db_magritoff-v5, 2026-09-19, `select count(*), count(*)
--      filter (where default_validity_days is null) from public.
--      commercial_settings`) : 0 ligne au total dans `commercial_settings`
--      sur cet environnement, donc 0 ligne concernee par ce backfill ICI.
--      Ce nombre ne dit rien d un environnement de staging ou de production,
--      non mesures par cette story -- l instruction est de ne jamais ecrire
--      un nombre qui n a pas ete mesure, celui-ci ne vaut donc que pour la
--      base locale. Le UPDATE reste ecrit pour tout environnement qui porte
--      deja des lignes a `null`.
--
-- Non fait ICI, volontairement (rapport de fin de story) :
--   - le report de 30 jours sur la duree de validite du devis Clariprint
--     conserve cote serveur (objet distinct de Q18, 24h proposees pour la
--     conservation des journaux de fonction) -- reste a confirmer au moment
--     de Q17-b, seul consommateur, exactement comme le cadrage le dit.
-- ============================================================================

alter table public.commercial_settings
  alter column default_validity_days set default 30;

update public.commercial_settings
   set default_validity_days = 30
 where default_validity_days is null;

comment on column public.commercial_settings.default_validity_days is
  'Nombre de jours de validite appliques a un devis dont valid_until est encore NULL, comptes depuis sendQuote (jamais depuis la creation). Modifier ce reglage ne recalcule AUCUN devis existant. Defaut de colonne : 30 (arbitrage Arnaud 2026-09-19, Q18) -- un espace amorce par api_get_commercial_settings recoit desormais 30 sans ecriture applicative explicite ; les espaces deja crees a NULL ont ete retrofites a 30 par cette meme migration (20260919000200_gescom_default_validity_days_30.sql). NULL reste une valeur valide (un commercial peut la reposer explicitement via PATCH /commercial-settings) : elle ne signifie plus "etat initial jamais decide", mais "aucune validite par defaut, choisie".';

-- ── ROLLBACK (documentation, non execute automatiquement) ──────────────────
--   alter table public.commercial_settings alter column default_validity_days drop default;
--   -- Le retrofit des lignes (etape 2 ci-dessus) N EST PAS REJOUE EN SENS
--   -- INVERSE par ce rollback : remettre a NULL des espaces dont la duree a
--   -- ete explicitement decidee par Arnaud reviendrait sur son arbitrage
--   -- sans nouvelle instruction (meme discipline que les migrations
--   -- precedentes du dossier, qui ne "derefont" jamais un choix de donnee
--   -- deja pose).
