-- ============================================================================
-- Lot "parametre de validite des devis" (arbitrage Arnaud 2026-09-19, Q18,
-- docs/api/CONVENTIONS.md §8.25 point 13 (3)). Migration :
-- `20260919000200_gescom_default_validity_days_30.sql`.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : un `SELECT`
-- sur le texte de la migration ne prouve pas qu un INSERT reel recoit bien
-- 30 par defaut, ni qu aucune ligne existante n est modifiee.
--
-- AVANT cette migration, le scenario A echoue (defaut de colonne absent :
-- un INSERT sans `default_validity_days` produisait NULL, jamais 30).
--
-- NE NECESSITE PAS `pnpm db:local:reset` -- `pnpm db:local:push` suffit.
-- C est ecrit ici parce que l auteur du lot a joue un reset "par precaution"
-- et a efface les comptes de la pile locale, qui est PARTAGEE entre tous les
-- worktrees et avec le poste d Arnaud. Ce fichier est autonome : il tourne
-- dans `begin; ... rollback;`, cree ses propres locataires et ses propres
-- lignes de reglages, et ne lit aucune donnee preexistante. Sa seule
-- dependance est que la migration soit APPLIQUEE.
--
-- CORRECTIF qa-review (2026-09-19, round suivant la premiere version de ce
-- fichier) : la premiere version portait un scenario B qui REJOUAIT SA
-- PROPRE COPIE d un `UPDATE` de backfill au lieu d exercer la migration
-- elle-meme -- retirer les trois lignes de backfill de la migration
-- n aurait rien fait rougir. La migration ne backfille plus AUCUNE ligne
-- existante (Q24, question ouverte : rien en base ne distingue « jamais
-- decide » de « explicitement choisi null », un backfill aveugle ecraserait
-- le second). Le scenario B ci-dessous verifie desormais l INVERSE de
-- l ancien : une ligne deja creee, explicitement a NULL, reste a NULL apres
-- l ALTER (pas d effet de bord sur les donnees existantes).
--
-- Scenarios :
--   A. Un nouvel espace amorce EXACTEMENT comme `api_get_commercial_settings`
--      le fait (`insert into commercial_settings (tenant_id) values (...)`,
--      sans jamais nommer `default_validity_days`) recoit 30 sans qu aucune
--      valeur ne soit ecrite explicitement.
--   B. Un espace DEJA CREE avant l alter (ligne existante, `default_
--      validity_days` explicitement `null`) N EST PAS touche : la migration
--      ne modifie que le defaut de colonne, jamais une ligne existante.
--   C. Le defaut de colonne ne rend pas NULL indisponible pour autant : un
--      commercial peut encore reposer explicitement `default_validity_days
--      = null` (PATCH /commercial-settings sans valeur de duree) -- ce test
--      empeche un futur correctif de transformer par erreur NULL en valeur
--      interdite.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

-- ── A — amorce d espace : INSERT (tenant_id) seul recoit 30 ────────────────
do $$
declare
  v_tenant uuid;
  v_days integer;
begin
  insert into public.tenants (slug, name) values ('gescom-validite-a', 'Gescom Validite A') returning id into v_tenant;

  insert into public.commercial_settings (tenant_id) values (v_tenant);

  select default_validity_days into v_days from public.commercial_settings where tenant_id = v_tenant;
  if v_days is distinct from 30 then
    raise exception 'scenario A : un espace amorce sans duree explicite doit recevoir 30 par defaut, obtenu %', v_days;
  end if;

  raise notice 'scenario A (amorce d espace, defaut de colonne = 30) OK';
end;
$$;

-- ── B — un espace DEJA CREE a NULL EXPLICITE n est jamais retrofite ────────
do $$
declare
  v_tenant uuid;
  v_days integer;
begin
  insert into public.tenants (slug, name) values ('gescom-validite-b', 'Gescom Validite B') returning id into v_tenant;

  -- NULL EXPLICITE (pas une omission) : reproduit une ligne deja existante
  -- avant que le defaut de colonne n existe -- qu elle porte ce null parce
  -- que personne n a jamais decide, ou parce qu un commercial l a choisi
  -- explicitement, la base ne distingue pas les deux cas (Q24).
  insert into public.commercial_settings (tenant_id, default_validity_days) values (v_tenant, null);

  -- Rejoue l effet de la migration (idempotent, sans donnee) sur le schema
  -- courant : poser un DEFAUT de colonne ne touche jamais une ligne deja
  -- ecrite, contrairement a un UPDATE.
  alter table public.commercial_settings alter column default_validity_days set default 30;

  select default_validity_days into v_days from public.commercial_settings where tenant_id = v_tenant;
  if v_days is not null then
    raise exception 'scenario B : une ligne DEJA CREEE a NULL explicite ne doit JAMAIS etre retrofitee par le defaut de colonne, obtenu %', v_days;
  end if;

  raise notice 'scenario B (aucun retrofit des espaces deja crees, Q24 reste ouverte) OK';
end;
$$;

-- ── C — NULL reste une valeur EXPLICITEMENT possible apres coup (PATCH) ────
do $$
declare
  v_tenant uuid;
  v_days integer;
begin
  insert into public.tenants (slug, name) values ('gescom-validite-c', 'Gescom Validite C') returning id into v_tenant;
  insert into public.commercial_settings (tenant_id) values (v_tenant);

  update public.commercial_settings set default_validity_days = null where tenant_id = v_tenant;

  select default_validity_days into v_days from public.commercial_settings where tenant_id = v_tenant;
  if v_days is not null then
    raise exception 'scenario C : un commercial doit pouvoir reposer NULL explicitement (aucune validite par defaut), obtenu %', v_days;
  end if;

  raise notice 'scenario C (NULL reste une valeur explicite valide apres le defaut de colonne) OK';
end;
$$;

rollback;
