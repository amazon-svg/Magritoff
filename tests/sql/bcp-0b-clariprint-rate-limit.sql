-- ============================================================================
-- BCP-0b — le limiteur de debit sur POST /api/v1/clariprint/quote (edge
-- function `magrit-api`), migration `20260915000100_bcp_0b_clariprint_rate_
-- limit.sql`. Contrat : docs/api/CONVENTIONS.md §8.25 point 2.3bis.
--
-- Test COMPORTEMENTAL, execute par psql contre la base locale : la fonction
-- `security definer` neuve vit ENTIEREMENT dans la migration — relire son
-- texte ne prouve pas qu elle se comporte correctement sous appel reel, en
-- particulier le "tout ou rien" et la bascule de fenetre.
--
-- Scenarios :
--   1. Droits et RLS : anon/authenticated refuses en select/insert/update/
--      delete sur les deux tables, et en execute sur les deux fonctions.
--      service_role passe.
--   2. Concurrence REELLE (deux connexions psql separees via dblink) : a une
--      unite du plafond, exactement un des deux appels concurrents est
--      accepte.
--   3. Tout ou rien : un visiteur sous L1 mais avec L3 epuise est refuse, et
--      son compteur L1 n a PAS bouge.
--   4. Fenetres : bascule de la fenetre fixe (10 min), bascule du jour civil
--      Europe/Paris, y compris la nuit du changement d heure du 25 octobre
--      2026.
--   5. Purge : supprime ce qui a plus de 24h, garde la fenetre du jour.
--   6. Configuration : un update de la limite prend effet DES l appel
--      suivant, sans redeploiement.
--   7. Aucune IP en clair : le CHECK `api_rate_limit_counters_key_hash_not_
--      raw_ip` rejette une forme IPv4/IPv6 ecrite telle quelle.
--   8. L3 est un compteur PARTAGE (une seule ligne pour toute la
--      plateforme), pas une ligne par visiteur.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

-- ── 1. Droits et RLS ─────────────────────────────────────────────────────────
do $$
declare
  v_granted text[];
begin
  select coalesce(array_agg(distinct grantee || ':' || privilege_type), '{}')
    into v_granted
    from information_schema.table_privileges
   where table_schema = 'public'
     and table_name in ('api_rate_limits', 'api_rate_limit_counters')
     and lower(grantee) in ('authenticated', 'anon', 'public');

  if array_length(v_granted, 1) is not null then
    raise exception 'api_rate_limits/api_rate_limit_counters expose % aux roles client', array_to_string(v_granted, ', ');
  end if;
end;
$$;

set local role authenticated;

do $$
declare
  v_rejected boolean := false;
begin
  begin
    perform 1 from public.api_rate_limits;
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'authenticated a pu SELECT api_rate_limits'; end if;

  v_rejected := false;
  begin
    perform 1 from public.api_rate_limit_counters;
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'authenticated a pu SELECT api_rate_limit_counters'; end if;

  v_rejected := false;
  begin
    insert into public.api_rate_limit_counters (scope, key_hash, window_start, hits)
    values ('clariprint_quote_visitor', 'ip:deadbeef', now(), 0);
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'authenticated a pu INSERT api_rate_limit_counters'; end if;

  v_rejected := false;
  begin
    perform public.api_consume_clariprint_quote_budget('visitor', 'ip:deadbeef');
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'authenticated a pu EXECUTE api_consume_clariprint_quote_budget'; end if;

  v_rejected := false;
  begin
    perform public.purge_expired_rate_limit_counters();
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'authenticated a pu EXECUTE purge_expired_rate_limit_counters'; end if;
end;
$$;

reset role;
set local role anon;

do $$
declare
  v_rejected boolean := false;
begin
  begin
    perform 1 from public.api_rate_limits;
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'anon a pu SELECT api_rate_limits'; end if;

  v_rejected := false;
  begin
    update public.api_rate_limits set max_hits = 1 where scope = 'clariprint_quote_visitor';
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'anon a pu UPDATE api_rate_limits'; end if;

  v_rejected := false;
  begin
    perform public.api_consume_clariprint_quote_budget('member', 'user:x');
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'anon a pu EXECUTE api_consume_clariprint_quote_budget'; end if;
end;
$$;

reset role;

-- service_role : la consommation passe.
set local role service_role;

do $$
declare
  v_allowed boolean;
begin
  select allowed into v_allowed from public.api_consume_clariprint_quote_budget('member', 'user:e10-bcp0b-rights-check');
  if v_allowed is not true then
    raise exception 'service_role n a pas pu consommer le budget';
  end if;
end;
$$;

reset role;

-- ── 3. Tout ou rien : L1 sous plafond, L3 epuise -> refuse, L1 inchange ────
do $$
declare
  v_key text := 'ip:e10-bcp0b-allornothing';
  v_hits_before integer;
  v_hits_after integer;
  v_allowed boolean;
  v_refused text;
begin
  update public.api_rate_limits set max_hits = 500 where scope = 'clariprint_quote_visitor';
  update public.api_rate_limits set max_hits = 1 where scope = 'clariprint_quote_public_daily';

  -- Un premier appel (autre visiteur) consomme le seul jeton de L3.
  perform public.api_consume_clariprint_quote_budget('visitor', 'ip:e10-bcp0b-other-visitor');

  select coalesce(hits, 0) into v_hits_before
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_visitor' and key_hash = v_key;
  v_hits_before := coalesce(v_hits_before, 0);

  select allowed, refused_scope into v_allowed, v_refused
    from public.api_consume_clariprint_quote_budget('visitor', v_key);

  if v_allowed is not false or v_refused is distinct from 'clariprint_quote_public_daily' then
    raise exception 'L3 epuise aurait du refuser (allowed=%, refused_scope=%)', v_allowed, v_refused;
  end if;

  select coalesce(hits, 0) into v_hits_after
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_visitor' and key_hash = v_key;
  v_hits_after := coalesce(v_hits_after, 0);

  if v_hits_after <> v_hits_before then
    raise exception 'Le compteur L1 du visiteur a bouge malgre le refus par L3 (% -> %)', v_hits_before, v_hits_after;
  end if;
end;
$$;

-- ── 8. L3 est PARTAGE : deux visiteurs distincts incrementent la MEME ligne ─
do $$
declare
  v_rows integer;
  v_hits integer;
begin
  delete from public.api_rate_limit_counters where scope = 'clariprint_quote_public_daily';
  update public.api_rate_limits set max_hits = 500 where scope = 'clariprint_quote_public_daily';

  perform public.api_consume_clariprint_quote_budget('visitor', 'ip:e10-bcp0b-shared-a');
  perform public.api_consume_clariprint_quote_budget('visitor', 'ip:e10-bcp0b-shared-b');

  select count(*) into v_rows from public.api_rate_limit_counters where scope = 'clariprint_quote_public_daily';
  if v_rows <> 1 then
    raise exception 'L3 devrait porter UNE SEULE ligne partagee, en porte %', v_rows;
  end if;

  select hits into v_hits from public.api_rate_limit_counters where scope = 'clariprint_quote_public_daily';
  if v_hits < 2 then
    raise exception 'La ligne partagee de L3 n a pas accumule les deux visiteurs (hits=%)', v_hits;
  end if;
end;
$$;

-- ── S5. L3 epuise : un MEMBRE chiffre toujours (l etage membre n inclut
-- JAMAIS le plafond public) — qa-review round 1, défaut moyen #5.
do $$
declare
  v_allowed boolean;
  v_refused text;
begin
  delete from public.api_rate_limit_counters where scope = 'clariprint_quote_public_daily';
  -- max_hits > 0 est impose par un CHECK : plafond a 1, consomme par un
  -- premier visiteur JETABLE, pour arriver a L3 REELLEMENT epuise.
  update public.api_rate_limits set max_hits = 1 where scope = 'clariprint_quote_public_daily';
  perform public.api_consume_clariprint_quote_budget('visitor', 'ip:e10-bcp0b-s5-warmup');

  -- Un second visiteur est refuse : L3 est bien a plat pour la portee publique.
  select allowed, refused_scope into v_allowed, v_refused
    from public.api_consume_clariprint_quote_budget('visitor', 'ip:e10-bcp0b-s5-visitor');
  if v_allowed is not false or v_refused is distinct from 'clariprint_quote_public_daily' then
    raise exception 'S5 : le visiteur temoin aurait du etre refuse par L3 (allowed=%, refused_scope=%)', v_allowed, v_refused;
  end if;

  -- Un membre, LUI, chiffre toujours : son etage ne porte JAMAIS L3.
  select allowed into v_allowed
    from public.api_consume_clariprint_quote_budget('member', 'user:e10-bcp0b-s5-member');
  if v_allowed is not true then
    raise exception 'S5 : un membre aurait du chiffrer meme avec L3 epuise (allowed=%)', v_allowed;
  end if;

  update public.api_rate_limits set max_hits = 500 where scope = 'clariprint_quote_public_daily';
end;
$$;

-- ── S7r. Refus L1 (etage propre au visiteur) : L3 reste INCHANGE — miroir
-- du scenario 3 (qui prouve l inverse : L3 epuise laisse L1 inchange).
-- qa-review round 1, défaut moyen #5/#7r.
do $$
declare
  v_key text := 'ip:e10-bcp0b-s7r';
  v_l3_hits_before integer;
  v_l3_hits_after integer;
  v_allowed boolean;
  v_refused text;
begin
  update public.api_rate_limits set max_hits = 500 where scope = 'clariprint_quote_public_daily';
  update public.api_rate_limits set max_hits = 1 where scope = 'clariprint_quote_visitor';

  -- Epuise le plafond L1 de CE visiteur (1 hit consomme).
  perform public.api_consume_clariprint_quote_budget('visitor', v_key);

  select coalesce(hits, 0) into v_l3_hits_before
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_public_daily' and key_hash = 'global';
  v_l3_hits_before := coalesce(v_l3_hits_before, 0);

  -- Second appel du MEME visiteur : refuse par L1 (son propre plafond, pas L3).
  select allowed, refused_scope into v_allowed, v_refused
    from public.api_consume_clariprint_quote_budget('visitor', v_key);
  if v_allowed is not false or v_refused is distinct from 'clariprint_quote_visitor' then
    raise exception 'S7r : le second appel aurait du etre refuse par L1, pas par % (allowed=%)', v_refused, v_allowed;
  end if;

  select coalesce(hits, 0) into v_l3_hits_after
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_public_daily' and key_hash = 'global';
  v_l3_hits_after := coalesce(v_l3_hits_after, 0);

  if v_l3_hits_after <> v_l3_hits_before then
    raise exception 'S7r : un refus L1 a consomme L3 (% -> %)', v_l3_hits_before, v_l3_hits_after;
  end if;

  update public.api_rate_limits set max_hits = 30 where scope = 'clariprint_quote_visitor';
end;
$$;

-- ── 4a. Fenetre fixe (10 min) : deux appels dans la meme fenetre partagent
-- le compteur, un appel 601s plus tard ouvre une fenetre neuve.
do $$
declare
  v_key text := 'ip:e10-bcp0b-window';
  v_base timestamptz := '2026-09-15 12:00:05+00'::timestamptz;
  v_hits_same integer;
  v_hits_next integer;
begin
  update public.api_rate_limits set max_hits = 500 where scope = 'clariprint_quote_visitor';

  perform public.api_consume_clariprint_quote_budget('visitor', v_key, v_base);
  perform public.api_consume_clariprint_quote_budget('visitor', v_key, v_base + interval '590 seconds');

  select hits into v_hits_same
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_visitor' and key_hash = v_key
     and window_start = to_timestamp(floor(extract(epoch from v_base) / 600) * 600);
  if v_hits_same <> 2 then
    raise exception 'Les deux appels dans la meme fenetre de 10 min auraient du partager le compteur (hits=%)', v_hits_same;
  end if;

  perform public.api_consume_clariprint_quote_budget('visitor', v_key, v_base + interval '601 seconds');
  select hits into v_hits_next
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_visitor' and key_hash = v_key
     and window_start = to_timestamp(floor(extract(epoch from (v_base + interval '601 seconds')) / 600) * 600);
  if v_hits_next <> 1 then
    raise exception 'La fenetre suivante aurait du repartir a 1 (hits=%)', v_hits_next;
  end if;
end;
$$;

-- ── 4b. Jour civil Europe/Paris, y compris le changement d heure du 25/10/2026
-- qa-review round 1 (défaut bas #6) : la version precedente calculait sa
-- valeur ATTENDUE avec la MEME expression que la fonction testee
-- (`date_trunc('day', ... at time zone 'Europe/Paris')`, SANS la seconde
-- conversion du correctif) — un test AVEUGLE au bug du fuseau de session,
-- puisqu il aurait affiche le MEME (mauvais) resultat des deux cotes. Les
-- valeurs attendues sont desormais des LITTERAUX UTC (verifies a la main,
-- voir le calcul en commentaire), independants de toute expression du code
-- teste.
do $$
declare
  v_key text := 'ip:e10-bcp0b-civilday';
  -- 24/10/2026 23:30 Paris (CEST, UTC+2) = 21:30 UTC : encore le 24 a Paris.
  v_before_midnight timestamptz := '2026-10-24 21:30:00+00'::timestamptz;
  -- 25/10/2026 00:30 Paris (CEST, UTC+2, avant le changement a 03:00 local)
  -- = 22:30 UTC le 24.
  v_early_25 timestamptz := '2026-10-24 22:30:00+00'::timestamptz;
  -- 25/10/2026 23:30 Paris (CET, UTC+1, APRES le changement) = 22:30 UTC le 25.
  v_late_25 timestamptz := '2026-10-25 22:30:00+00'::timestamptz;
  -- 26/10/2026 00:30 Paris (CET, UTC+1) = 23:30 UTC le 25.
  v_26 timestamptz := '2026-10-25 23:30:00+00'::timestamptz;
  -- Minuit Paris de chaque jour, en UTC — LITTERAUX, jamais recalcules avec
  -- l expression du code teste :
  --   24/10 00:00 Paris (CEST, +2) = 23/10 22:00 UTC
  --   25/10 00:00 Paris (CEST, +2 — le changement n a lieu que ce jour-la,
  --     a 03:00 LOCAL, donc APRES minuit) = 24/10 22:00 UTC
  --   26/10 00:00 Paris (CET, +1, le changement a deja eu lieu) = 25/10 23:00 UTC
  v_expected_24 timestamptz := '2026-10-23 22:00:00+00'::timestamptz;
  v_expected_25 timestamptz := '2026-10-24 22:00:00+00'::timestamptz;
  v_expected_26 timestamptz := '2026-10-25 23:00:00+00'::timestamptz;
  v_rows_25 integer;
  v_hits_25 integer;
  v_hits_24 integer;
  v_hits_26 integer;
begin
  delete from public.api_rate_limit_counters where scope = 'clariprint_quote_public_daily';
  update public.api_rate_limits set max_hits = 500 where scope = 'clariprint_quote_public_daily';

  -- Le 24 (avant minuit Paris) : PAS le meme jour que le 25.
  perform public.api_consume_clariprint_quote_budget('visitor', v_key, v_before_midnight);
  -- Deux appels le 25, un AVANT et un APRES le changement d heure local :
  -- meme jour civil Paris, DOIVENT partager la MEME ligne malgre l heure
  -- elastique.
  perform public.api_consume_clariprint_quote_budget('visitor', v_key, v_early_25);
  perform public.api_consume_clariprint_quote_budget('visitor', v_key, v_late_25);
  -- Le 26 : jour civil suivant, nouvelle ligne.
  perform public.api_consume_clariprint_quote_budget('visitor', v_key, v_26);

  select count(*) into v_rows_25
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_public_daily' and window_start = v_expected_25;
  if v_rows_25 <> 1 then
    raise exception 'Le 25/10 avant et apres le changement d heure aurait du tomber sur UNE SEULE ligne, a l instant UTC attendu % (lignes=%)', v_expected_25, v_rows_25;
  end if;

  select hits into v_hits_25
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_public_daily' and window_start = v_expected_25;
  if v_hits_25 <> 2 then
    raise exception 'Le 25/10 aurait du accumuler 2 appels malgre le changement d heure (hits=%)', v_hits_25;
  end if;

  select hits into v_hits_24
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_public_daily' and window_start = v_expected_24;
  if v_hits_24 is distinct from 1 then
    raise exception 'Le 24/10 aurait du tomber a l instant UTC attendu % (hits=%)', v_expected_24, v_hits_24;
  end if;

  select hits into v_hits_26
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_public_daily' and window_start = v_expected_26;
  if v_hits_26 is distinct from 1 then
    raise exception 'Le 26/10 aurait du tomber a l instant UTC attendu % (hits=%)', v_expected_26, v_hits_26;
  end if;

  if (
    select count(distinct window_start) from public.api_rate_limit_counters
     where scope = 'clariprint_quote_public_daily'
  ) <> 3 then
    raise exception 'Le 24, le 25 et le 26 octobre auraient du produire TROIS fenetres distinctes';
  end if;
end;
$$;

-- ── 4c. Le jour de L3 NE DEPEND PAS du fuseau de la SESSION appelante ─────
-- qa-review round 1 (défaut bas #6) : sans la seconde conversion
-- (`at time zone v_civil_tz` appliquee au resultat DEJA tronque), le meme
-- instant p_now, appele depuis une session `America/New_York` puis depuis
-- une session `UTC`, produirait DEUX lignes de compteur differentes pour
-- ce qui doit rester le MEME jour civil Paris — deux visiteurs derriere
-- deux connexions PostgREST dont la session porterait un `TimeZone` GUC
-- different verraient alors CHACUN leur propre "jour", et L3 ne bornerait
-- plus rien de coherent.
do $$
declare
  v_key text := 'ip:e10-bcp0b-tzcheck';
  -- minuit Paris (CEST) du 15/09/2026, LITTERAL, jamais recalcule.
  v_expected constant timestamptz := '2026-09-14 22:00:00+00'::timestamptz;
  v_rows integer;
  v_hits integer;
  v_window_start timestamptz;
begin
  delete from public.api_rate_limit_counters where scope = 'clariprint_quote_public_daily';
  update public.api_rate_limits set max_hits = 500 where scope = 'clariprint_quote_public_daily';

  set local time zone 'America/New_York';
  perform public.api_consume_clariprint_quote_budget('visitor', v_key, '2026-09-15T12:00:00Z'::timestamptz);

  set local time zone 'UTC';
  perform public.api_consume_clariprint_quote_budget('visitor', v_key, '2026-09-15T12:00:00Z'::timestamptz);

  set local time zone 'Europe/Paris';
  perform public.api_consume_clariprint_quote_budget('visitor', v_key, '2026-09-15T12:00:00Z'::timestamptz);

  reset time zone;

  select count(*) into v_rows from public.api_rate_limit_counters where scope = 'clariprint_quote_public_daily';
  if v_rows <> 1 then
    raise exception 'Le jour civil L3 depend du fuseau de la SESSION appelante : % lignes au lieu d une seule pour le meme instant', v_rows;
  end if;

  select hits, window_start into v_hits, v_window_start
    from public.api_rate_limit_counters where scope = 'clariprint_quote_public_daily';
  if v_hits <> 3 then
    raise exception 'Les trois appels (fuseaux de session differents) auraient du partager LA MEME ligne (hits=%)', v_hits;
  end if;

  if v_window_start <> v_expected then
    raise exception 'window_start attendu %, obtenu % (le jour civil L3 depend du fuseau de la session)', v_expected, v_window_start;
  end if;
end;
$$;

-- ── 6. Configuration : un update prend effet DES l appel suivant ───────────
do $$
declare
  v_key text := 'ip:e10-bcp0b-config';
  v_allowed boolean;
begin
  update public.api_rate_limits set max_hits = 500 where scope = 'clariprint_quote_visitor';
  perform public.api_consume_clariprint_quote_budget('visitor', v_key);

  update public.api_rate_limits set max_hits = 1 where scope = 'clariprint_quote_visitor';
  select allowed into v_allowed from public.api_consume_clariprint_quote_budget('visitor', v_key);
  if v_allowed is not false then
    raise exception 'Le nouveau plafond (max_hits=1, deja 1 hit) aurait du refuser immediatement, sans redeploiement';
  end if;

  update public.api_rate_limits set max_hits = 30 where scope = 'clariprint_quote_visitor';
end;
$$;

-- ── 5. Purge : au-dela de 24h supprime, la fenetre du jour est conservee ──
do $$
declare
  v_old_count integer;
  v_kept_count integer;
  v_deleted integer;
begin
  insert into public.api_rate_limit_counters (scope, key_hash, window_start, hits)
  values ('clariprint_quote_visitor', 'ip:e10-bcp0b-purge-old', now() - interval '25 hours', 3);

  insert into public.api_rate_limit_counters (scope, key_hash, window_start, hits)
  values ('clariprint_quote_public_daily', 'global', date_trunc('day', now() at time zone 'Europe/Paris'), 7)
  on conflict (scope, key_hash, window_start) do update set hits = 7;

  v_deleted := public.purge_expired_rate_limit_counters();

  select count(*) into v_old_count
    from public.api_rate_limit_counters
   where key_hash = 'ip:e10-bcp0b-purge-old';
  if v_old_count <> 0 then
    raise exception 'La ligne de plus de 24h aurait du etre purgee';
  end if;

  select count(*) into v_kept_count
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_public_daily'
     and window_start = date_trunc('day', now() at time zone 'Europe/Paris');
  if v_kept_count <> 1 then
    raise exception 'La fenetre du jour civil en cours n aurait pas du etre purgee';
  end if;

  if v_deleted < 1 then
    raise exception 'purge_expired_rate_limit_counters aurait du rendre au moins 1 ligne supprimee';
  end if;
end;
$$;

-- ── 7. Aucune IP en clair : le CHECK rejette une forme IPv4/IPv6 en clair ──
do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.api_rate_limit_counters (scope, key_hash, window_start, hits)
    values ('clariprint_quote_visitor', '198.51.100.7', now(), 0);
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Une IPv4 en clair a ete acceptee comme key_hash'; end if;

  v_rejected := false;
  begin
    insert into public.api_rate_limit_counters (scope, key_hash, window_start, hits)
    values ('clariprint_quote_visitor', '2001:db8::42', now(), 0);
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Une IPv6 en clair a ete acceptee comme key_hash'; end if;

  -- Temoin : une cle legitime (HMAC hex prefixe) reste acceptee.
  insert into public.api_rate_limit_counters (scope, key_hash, window_start, hits)
  values ('clariprint_quote_visitor', 'ip:abcd1234ef567890abcd1234ef567890abcd1234ef567890abcd1234ef5678', now(), 0);
end;
$$;

rollback;

-- ============================================================================
-- ── S3. CONCURRENCE REELLE — N SESSIONS Postgres separees, ENVOYEES ENSEMBLE
-- ── qa-review round 1 : la version precedente (deux connexions, une
-- SYNCHRONE puis une ASYNCHRONE qui attend la premiere) ne prouvait que
-- l attente d UN SEUL suiveur sur UN SEUL detenteur de verrou — elle
-- restait VERTE meme en retirant le `for update` de la fonction, puisque
-- l `insert ... on conflict` fait DEJA attendre B independamment de tout
-- `for update` sur le SELECT qui decide. Prouve mesure par la qa (20
-- sessions, plafond 5, 1 deja consomme) : code actuel -> 4 acceptes ;
-- sans `for update` -> 5 a 12 acceptes.
--
-- Ce scenario envoie N=20 requetes ENSEMBLE (`dblink_send_query`, TOUTES
-- avant de lire le moindre resultat), puis les DRAINE par SCRUTATION
-- (`dblink_is_busy`) : chaque connexion dont le resultat est pret est
-- immediatement COMMITEE (liberant son verrou pour la suivante), jusqu a
-- ce que les 20 aient repondu. Sans cette scrutation, lire les resultats
-- dans un ORDRE FIXE bloquerait indefiniment sur une connexion qui n a pas
-- encore obtenu le verrou (interblocage de l ORCHESTRATION, pas de la
-- base) — d ou l avertissement de la qa sur les fixtures : elles doivent
-- etre COMMITEES (statement top-level autonome) AVANT d ouvrir les N
-- connexions, jamais a l interieur d une transaction encore ouverte.
--
-- Meme patron dblink que tests/sql/gescom-e10-12-quote-conversion.sql.
-- `:dblink_host`/`:dblink_password` fournis par scripts/test-storefront-
-- sql.sh, lus dynamiquement (aucun secret commis).
-- ============================================================================

create extension if not exists dblink with schema extensions;

create temporary table e10_bcp0b_race_context (connstr text);

insert into e10_bcp0b_race_context (connstr) values (
  format('dbname=postgres user=postgres password=%s host=%s', :'dblink_password', :'dblink_host')
);

-- Fixtures — statement top-level AUTONOME (autocommit), donc COMMITEES
-- avant que le bloc suivant n ouvre les 20 connexions dblink. Plafond a 5,
-- 1 hit DEJA consomme -> il reste EXACTEMENT 4 places pour les 20 appels
-- concurrents ci-dessous (mesure qa-review).
do $$
begin
  delete from public.api_rate_limit_counters where key_hash = 'user:e10-bcp0b-race-n';
  update public.api_rate_limits set max_hits = 5 where scope = 'clariprint_quote_member';
  perform public.api_consume_clariprint_quote_budget('member', 'user:e10-bcp0b-race-n');
end;
$$;

do $$
declare
  v_connstr text;
  v_conn text;
  v_done boolean[] := array_fill(false, array[20]);
  v_allowed boolean[] := array_fill(false, array[20]);
  v_accepted integer := 0;
  v_remaining integer := 20;
  v_hits integer;
  v_iterations integer := 0;
  v_result boolean;
  i integer;
begin
  select connstr into v_connstr from e10_bcp0b_race_context;

  -- Ouvre et LANCE les 20 requetes ENSEMBLE, AVANT de lire le moindre
  -- resultat : c est ce qui garantit qu elles se disputent REELLEMENT le
  -- meme verrou de ligne, plutot que de se succeder proprement.
  for i in 1 .. 20 loop
    v_conn := 'race_n_' || i;
    perform extensions.dblink_connect(v_conn, v_connstr);
    perform extensions.dblink_exec(v_conn, 'begin');
    perform extensions.dblink_exec(v_conn, 'set local role service_role');
    perform extensions.dblink_send_query(
      v_conn,
      $sql$select allowed from public.api_consume_clariprint_quote_budget('member', 'user:e10-bcp0b-race-n')$sql$
    );
  end loop;

  -- Draine par SCRUTATION : une connexion dont le resultat est pret est
  -- COMMITEE IMMEDIATEMENT (libere son verrou pour la suivante qui
  -- attendait dessus), jusqu a ce que les 20 aient repondu. Garde-fou de
  -- 500 tours (~10s a 0.02s/tour) pour ne jamais bloquer indefiniment en
  -- cas de regression reelle (interblocage cote fonction, par exemple).
  while v_remaining > 0 and v_iterations < 500 loop
    for i in 1 .. 20 loop
      if not v_done[i] and extensions.dblink_is_busy('race_n_' || i) = 0 then
        select result into v_result from extensions.dblink_get_result('race_n_' || i) as t(result boolean);
        perform extensions.dblink_get_result('race_n_' || i); -- draine a NULL
        perform extensions.dblink_exec('race_n_' || i, 'commit');
        v_done[i] := true;
        v_allowed[i] := v_result;
        v_remaining := v_remaining - 1;
        if v_result then v_accepted := v_accepted + 1; end if;
      end if;
    end loop;
    if v_remaining > 0 then
      perform pg_sleep(0.02);
      v_iterations := v_iterations + 1;
    end if;
  end loop;

  for i in 1 .. 20 loop
    perform extensions.dblink_disconnect('race_n_' || i);
  end loop;

  if v_remaining > 0 then
    raise exception 'S3 : % des 20 connexions concurrentes n ont jamais repondu (interblocage ?)', v_remaining;
  end if;

  -- Plafond 5, 1 deja consomme AVANT la rafale -> EXACTEMENT 4 acceptes
  -- parmi les 20 appels concurrents (mesure qa-review : sans `for update`,
  -- 5 a 12 seraient acceptes).
  if v_accepted <> 4 then
    raise exception 'S3 : % acceptes sur 20 appels concurrents, 4 attendus (plafond 5, 1 deja consomme)', v_accepted;
  end if;

  select hits into v_hits
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_member' and key_hash = 'user:e10-bcp0b-race-n';
  if v_hits <> 5 then
    raise exception 'S3 : hits devrait valoir EXACTEMENT le plafond (5) apres la rafale, vaut %', v_hits;
  end if;

  delete from public.api_rate_limit_counters where key_hash = 'user:e10-bcp0b-race-n';
  update public.api_rate_limits set max_hits = 120 where scope = 'clariprint_quote_member';
exception
  when others then
    for i in 1 .. 20 loop
      begin
        perform extensions.dblink_disconnect('race_n_' || i);
      exception when others then null;
      end;
    end loop;
    delete from public.api_rate_limit_counters where key_hash = 'user:e10-bcp0b-race-n';
    update public.api_rate_limits set max_hits = 120 where scope = 'clariprint_quote_member';
    raise;
end;
$$;

drop table e10_bcp0b_race_context;
