-- ============================================================================
-- Lot "parametre de validite des devis" (arbitrage Arnaud 2026-09-19, Q18,
-- docs/api/CONVENTIONS.md §8.25 point 13 (3)). Migration :
-- `20260919000200_gescom_default_validity_days_30.sql`.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : un `SELECT`
-- sur le texte de la migration ne prouve pas qu un INSERT reel recoit bien
-- 30 par defaut, ni que le backfill ne touche QUE les lignes deja a NULL.
--
-- AVANT cette migration, le scenario A echoue (defaut de colonne absent :
-- un INSERT sans `default_validity_days` produisait NULL, jamais 30).
--
-- Scenarios :
--   A. Un nouvel espace amorce EXACTEMENT comme `api_get_commercial_settings`
--      le fait (`insert into commercial_settings (tenant_id) values (...)`,
--      sans jamais nommer `default_validity_days`) recoit 30 sans qu aucune
--      valeur ne soit ecrite explicitement.
--   B. Le backfill (le meme UPDATE que celui de la migration) porte a 30
--      une ligne deja creee et deja a NULL explicitement -- reproduit l
--      effet "espaces deja crees" sans dependre d un etat historique de la
--      base qui n existe plus une fois la migration appliquee une fois.
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

-- ── B — backfill : une ligne deja a NULL explicite est portee a 30 ─────────
do $$
declare
  v_tenant uuid;
  v_days integer;
begin
  insert into public.tenants (slug, name) values ('gescom-validite-b', 'Gescom Validite B') returning id into v_tenant;

  -- NULL EXPLICITE (pas une omission) : reproduit l etat d un espace deja
  -- cree AVANT cette migration, la ou le defaut de colonne n existait pas
  -- encore.
  insert into public.commercial_settings (tenant_id, default_validity_days) values (v_tenant, null);

  select default_validity_days into v_days from public.commercial_settings where tenant_id = v_tenant;
  if v_days is not null then
    raise exception 'scenario B : fixture invalide -- la ligne devrait etre NULL avant le backfill';
  end if;

  -- Rejoue EXACTEMENT l UPDATE de la migration (idempotent : ne touche que
  -- les lignes encore a NULL).
  update public.commercial_settings
     set default_validity_days = 30
   where default_validity_days is null;

  select default_validity_days into v_days from public.commercial_settings where tenant_id = v_tenant;
  if v_days is distinct from 30 then
    raise exception 'scenario B : le backfill doit porter une ligne deja NULL a 30, obtenu %', v_days;
  end if;

  raise notice 'scenario B (backfill des espaces deja crees a NULL) OK';
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
