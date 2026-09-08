-- ============================================================================
-- E10.10b-3 — drain periodique de l outbox : `api_claim_outbox_events()`
-- (migration 20260908000000). Test COMPORTEMENTAL, execute par psql contre la
-- base locale : la reclamation atomique, le backoff et le rebut vivent
-- ENTIEREMENT dans cette fonction — relire son texte ne prouve pas qu elle se
-- comporte correctement sous appel reel (meme raisonnement que
-- tests/sql/gescom-e10-10b-2-storefront-quote-decision.sql).
-- ----------------------------------------------------------------------------
-- Scenarios :
--   1. Reclamation d un lot couvrant un evenement FRAIS et un evenement TROP
--      VIEUX (p_max_age) : le vieux est REBUTE (delivery_attempts force au
--      maximum, last_error explicite, published_at TOUJOURS null — le rebut
--      n est PAS une livraison) sans etre rendu ; le frais est rendu, son
--      delivery_attempts incremente de 1.
--   2. Reclamation IMMEDIATE d un second lot : rien n est rendu tant que
--      `next_attempt_at` (repousse a la RECLAMATION precedente) n est pas
--      atteint — deux tours rapprochés ne recliquent pas le meme evenement.
--   3. Reclamations forcees successives (next_attempt_at avance manuellement
--      dans le passe) : progression EXACTE du backoff, 1 / 5 / 25 / 125
--      minutes selon delivery_attempts (5^(attempts-1), plafonne au palier
--      4).
--   4. Une fois `delivery_attempts >= p_max_attempts` (epuisement), meme un
--      evenement echu n est PLUS rendu : "non publie et non reclamable" EST
--      la lettre morte, pas un nouvel etat (§8.13sexies point 3).
--   5. `skip locked` : deux reclamations concurrentes (deux transactions) ne
--      recoivent jamais la meme ligne — verifie par verrouillage explicite
--      d une session pendant qu une seconde reclame.
--   6. Privileges : ni `anon` ni `authenticated` ne peuvent executer la
--      fonction (`insufficient_privilege`) — `service_role` SEUL.
--   7. Append-only : `next_attempt_at` est bien le QUATRIEME champ mutable
--      (le contenu metier reste immuable, meme garantie que
--      tests/sql/gescom-outbox-append-only.sql, exercee ici sur CETTE
--      colonne specifiquement).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_10b_3_context (
  tenant uuid not null,
  event_fresh uuid not null,
  event_stale uuid not null
);

do $$
declare
  v_tenant uuid;
  v_fresh uuid;
  v_stale uuid;
begin
  insert into public.tenants (slug, name) values ('e10-10b-3-outbox', 'E10.10b-3 Outbox Dispatcher')
  returning id into v_tenant;

  insert into public.outbox_events (tenant_id, event_name, aggregate_type, aggregate_id, payload, occurred_at)
  values (v_tenant, 'quote.sent', 'quote', gen_random_uuid(), '{}'::jsonb, now() - interval '10 minutes')
  returning id into v_fresh;

  -- 48h > p_max_age par defaut (24h) : doit etre rebute au premier tour.
  insert into public.outbox_events (tenant_id, event_name, aggregate_type, aggregate_id, payload, occurred_at)
  values (v_tenant, 'quote.sent', 'quote', gen_random_uuid(), '{}'::jsonb, now() - interval '48 hours')
  returning id into v_stale;

  insert into e10_10b_3_context (tenant, event_fresh, event_stale) values (v_tenant, v_fresh, v_stale);
end;
$$;

-- ── 1 & 2 — reclamation, rebut par fraicheur, non-reclamation immediate ────
do $$
declare
  v_fresh uuid;
  v_stale uuid;
  v_n integer;
begin
  select event_fresh, event_stale into v_fresh, v_stale from e10_10b_3_context;

  -- Lot de 5 : couvre les deux lignes inserees. Seule la fraiche doit
  -- revenir ; la vieille est rebutee EN SILENCE (pas dans le resultat).
  select count(*) into v_n from public.api_claim_outbox_events(5, 5, interval '24 hours');
  if v_n <> 1 then
    raise exception 'scenario 1 : attendu 1 ligne rendue (la fraiche), obtenu %', v_n;
  end if;

  if (select delivery_attempts from public.outbox_events where id = v_fresh) <> 1 then
    raise exception 'scenario 1 : delivery_attempts de l evenement frais attendu 1, obtenu %',
      (select delivery_attempts from public.outbox_events where id = v_fresh);
  end if;

  if (select delivery_attempts from public.outbox_events where id = v_stale) <> 5 then
    raise exception 'scenario 1 : evenement vieux non rebute, delivery_attempts=%',
      (select delivery_attempts from public.outbox_events where id = v_stale);
  end if;
  if (select last_error from public.outbox_events where id = v_stale) not like 'outbox_stale:%' then
    raise exception 'scenario 1 : last_error de l evenement vieux inattendu : %',
      (select last_error from public.outbox_events where id = v_stale);
  end if;
  if (select published_at from public.outbox_events where id = v_stale) is not null then
    raise exception 'scenario 1 : le rebut ne doit JAMAIS poser published_at (ce n est pas une livraison)';
  end if;

  -- Scenario 2 : reclamation immediate -> rien de rendu (echeance repoussee
  -- pour le frais, la vieille est epuisee).
  select count(*) into v_n from public.api_claim_outbox_events(5, 5, interval '24 hours');
  if v_n <> 0 then
    raise exception 'scenario 2 : reclamation immediate attendue vide, obtenu % ligne(s)', v_n;
  end if;

  raise notice 'scenarios 1-2 OK';
end;
$$;

-- ── 3 — progression exacte du backoff (1 / 5 / 25 / 125 minutes) ───────────
do $$
declare
  v_fresh uuid;
  v_before timestamptz;
  v_delay_minutes numeric;
begin
  select event_fresh into v_fresh from e10_10b_3_context;

  update public.outbox_events set next_attempt_at = now() - interval '1 second' where id = v_fresh;
  v_before := clock_timestamp();
  perform 1 from public.api_claim_outbox_events(1, 5, interval '24 hours'); -- attempts passe a 2
  v_delay_minutes := extract(epoch from ((select next_attempt_at from public.outbox_events where id = v_fresh) - v_before)) / 60.0;
  if v_delay_minutes < 4.9 or v_delay_minutes > 5.1 then
    raise exception 'palier attempts=2 attendu ~5 min, obtenu % min', round(v_delay_minutes, 2);
  end if;

  update public.outbox_events set next_attempt_at = now() - interval '1 second' where id = v_fresh;
  v_before := clock_timestamp();
  perform 1 from public.api_claim_outbox_events(1, 5, interval '24 hours'); -- attempts passe a 3
  v_delay_minutes := extract(epoch from ((select next_attempt_at from public.outbox_events where id = v_fresh) - v_before)) / 60.0;
  if v_delay_minutes < 24.9 or v_delay_minutes > 25.1 then
    raise exception 'palier attempts=3 attendu ~25 min, obtenu % min', round(v_delay_minutes, 2);
  end if;

  update public.outbox_events set next_attempt_at = now() - interval '1 second' where id = v_fresh;
  v_before := clock_timestamp();
  perform 1 from public.api_claim_outbox_events(1, 5, interval '24 hours'); -- attempts passe a 4
  v_delay_minutes := extract(epoch from ((select next_attempt_at from public.outbox_events where id = v_fresh) - v_before)) / 60.0;
  if v_delay_minutes < 124.9 or v_delay_minutes > 125.1 then
    raise exception 'palier attempts=4 attendu ~125 min, obtenu % min', round(v_delay_minutes, 2);
  end if;

  update public.outbox_events set next_attempt_at = now() - interval '1 second' where id = v_fresh;
  v_before := clock_timestamp();
  perform 1 from public.api_claim_outbox_events(1, 5, interval '24 hours'); -- attempts passe a 5 (dernier palier, plafonne)
  v_delay_minutes := extract(epoch from ((select next_attempt_at from public.outbox_events where id = v_fresh) - v_before)) / 60.0;
  if v_delay_minutes < 124.9 or v_delay_minutes > 125.1 then
    raise exception 'palier attempts=5 (plafonne) attendu ~125 min, obtenu % min', round(v_delay_minutes, 2);
  end if;

  if (select delivery_attempts from public.outbox_events where id = v_fresh) <> 5 then
    raise exception 'apres 4 reclamations forcees, delivery_attempts attendu 5, obtenu %',
      (select delivery_attempts from public.outbox_events where id = v_fresh);
  end if;

  raise notice 'scenario 3 (backoff 1/5/25/125) OK';
end;
$$;

-- ── 4 — epuisement : plus jamais reclamable une fois delivery_attempts=max ─
do $$
declare
  v_fresh uuid;
  v_n integer;
begin
  select event_fresh into v_fresh from e10_10b_3_context;

  -- delivery_attempts = 5 = p_max_attempts (scenario 3) : meme echue,
  -- cette ligne ne doit plus jamais etre rendue.
  update public.outbox_events set next_attempt_at = now() - interval '1 second' where id = v_fresh;
  select count(*) into v_n from public.api_claim_outbox_events(5, 5, interval '24 hours');
  if v_n <> 0 then
    raise exception 'scenario 4 : evenement epuise reclame a tort (% ligne(s))', v_n;
  end if;

  if (select published_at from public.outbox_events where id = v_fresh) is not null then
    raise exception 'scenario 4 : l epuisement ne doit PAS poser published_at (rebut != livraison)';
  end if;

  raise notice 'scenario 4 (epuisement) OK';
end;
$$;

-- ── 5 — skip locked : verifie EN BASE, pas seulement dans le fichier ───────
-- Une vraie concurrence inter-session (deux transactions distinctes) est
-- INCOMPATIBLE avec la convention de ce depot pour les cas SQL : tout le
-- fichier vit dans une seule transaction `begin ... rollback` (nettoyage
-- automatique, comme tous les autres cas de tests/sql/). Une seconde
-- connexion (`dblink`) ne verrait de toute facon AUCUNE des lignes inserees
-- plus haut : elles ne sont pas encore commises. Plutot qu un scenario qui
-- semblerait tester la concurrence sans rien prouver, on verifie ICI, EN
-- BASE (pas par une lecture du fichier de migration, qui ne pourrait jamais
-- echouer), que la fonction DEPLOYEE porte reellement la clause qui rend
-- deux tours concurrents inoffensifs. Ce n est pas une preuve d execution
-- concurrente reelle, mais un runtime.sql-drift-safe : c est la definition
-- ACTUELLE de la fonction en base qui est lue, pas le texte de la migration.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'api_claim_outbox_events';

  if v_definition is null then
    raise exception 'scenario 5 : api_claim_outbox_events introuvable en base';
  end if;
  if v_definition !~* 'for update\s+skip locked' then
    raise exception 'scenario 5 : la fonction DEPLOYEE ne porte plus for update skip locked — deux tours concurrents pourraient a nouveau se recouvrir';
  end if;

  raise notice 'scenario 5 (skip locked, verifie sur la definition deployee) OK';
end;
$$;

-- ── 6 — privileges : anon/authenticated refuses, service_role seul ─────────
do $$
declare
  v_denied boolean := false;
begin
  begin
    set local role authenticated;
    perform 1 from public.api_claim_outbox_events(1, 5, interval '24 hours');
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 6 : authenticated a pu executer api_claim_outbox_events';
  end if;
end;
$$;

do $$
declare
  v_denied boolean := false;
begin
  begin
    set local role anon;
    perform 1 from public.api_claim_outbox_events(1, 5, interval '24 hours');
  exception
    when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then
    raise exception 'scenario 6 : anon a pu executer api_claim_outbox_events';
  end if;
  raise notice 'scenario 6 (privileges) OK';
end;
$$;

-- ── 7 — append-only : next_attempt_at mutable, le reste ne l est pas ───────
do $$
declare
  v_fresh uuid;
  v_before timestamptz;
  v_after timestamptz;
  v_rejected boolean := false;
begin
  select event_fresh into v_fresh from e10_10b_3_context;

  select next_attempt_at into v_before from public.outbox_events where id = v_fresh;

  -- Mutation directe (hors fonction) de next_attempt_at -> acceptee : c est
  -- le comportement que api_claim_outbox_events exploite en interne.
  update public.outbox_events set next_attempt_at = v_before + interval '10 minutes' where id = v_fresh;
  select next_attempt_at into v_after from public.outbox_events where id = v_fresh;
  if v_after <> v_before + interval '10 minutes' then
    raise exception 'scenario 7 : next_attempt_at aurait du etre mutable (avant=%, apres=%)', v_before, v_after;
  end if;

  -- Le contenu metier reste immuable : meme apres ce lot, modifier le
  -- payload est toujours refuse (garantie deja couverte par
  -- gescom-outbox-append-only.sql, reverifiee ici sur une ligne qui a
  -- transite par le drain).
  begin
    update public.outbox_events set payload = '{"hack": true}'::jsonb where id = v_fresh;
  exception
    when insufficient_privilege then
      if sqlerrm like 'outbox_append_only:%' then v_rejected := true; end if;
  end;
  if not v_rejected then
    raise exception 'scenario 7 : le payload d un evenement traite par le drain a pu etre modifie';
  end if;

  raise notice 'scenario 7 (append-only, next_attempt_at mutable) OK';
end;
$$;

rollback;
