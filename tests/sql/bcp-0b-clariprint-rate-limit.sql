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
  v_rows_25 integer;
  v_hits_25 integer;
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
   where scope = 'clariprint_quote_public_daily'
     and window_start = date_trunc('day', v_early_25 at time zone 'Europe/Paris');
  if v_rows_25 <> 1 then
    raise exception 'Le 25/10 avant et apres le changement d heure aurait du tomber sur UNE SEULE ligne (lignes=%)', v_rows_25;
  end if;

  select hits into v_hits_25
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_public_daily'
     and window_start = date_trunc('day', v_early_25 at time zone 'Europe/Paris');
  if v_hits_25 <> 2 then
    raise exception 'Le 25/10 aurait du accumuler 2 appels malgre le changement d heure (hits=%)', v_hits_25;
  end if;

  if (
    select count(distinct window_start) from public.api_rate_limit_counters
     where scope = 'clariprint_quote_public_daily'
  ) <> 3 then
    raise exception 'Le 24, le 25 et le 26 octobre auraient du produire TROIS fenetres distinctes';
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
-- ── CONCURRENCE REELLE — deux SESSIONS Postgres separees ────────────────────
-- Meme patron que tests/sql/gescom-e10-12-quote-conversion.sql (dblink
-- asynchrone, PAS dblink()/dblink_exec() seuls qui sont bloquants).
-- `:dblink_host`/`:dblink_password` fournis par scripts/test-storefront-
-- sql.sh, lus dynamiquement (aucun secret commis).
-- ============================================================================

create extension if not exists dblink with schema extensions;

create temporary table e10_bcp0b_race_context (connstr text);

insert into e10_bcp0b_race_context (connstr) values (
  format('dbname=postgres user=postgres password=%s host=%s', :'dblink_password', :'dblink_host')
);

-- Fixtures : un hit deja consomme, plafond a 2 -> a une unite du plafond, un
-- SEUL des deux appels concurrents ci-dessous doit reussir.
do $$
begin
  delete from public.api_rate_limit_counters where key_hash = 'user:e10-bcp0b-race';
  update public.api_rate_limits set max_hits = 2 where scope = 'clariprint_quote_member';
  perform public.api_consume_clariprint_quote_budget('member', 'user:e10-bcp0b-race');
end;
$$;

do $$
declare
  v_connstr text;
  v_allowed_a boolean;
  v_allowed_b boolean;
  v_hits integer;
begin
  select connstr into v_connstr from e10_bcp0b_race_context;

  perform extensions.dblink_connect('race_a', v_connstr);
  perform extensions.dblink_connect('race_b', v_connstr);

  -- Session A : SYNCHRONE (dblink() bloque cette session orchestratrice
  -- jusqu a la fin de l appel, mais A elle-meme ne fait qu executer et
  -- rendre — sa transaction reste OUVERTE, verrou de ligne TENU, tant
  -- qu on ne lui envoie pas explicitement `commit`).
  perform extensions.dblink_exec('race_a', 'begin');
  perform extensions.dblink_exec('race_a', 'set local role service_role');
  select result into v_allowed_a from extensions.dblink(
    'race_a',
    $sql$select allowed from public.api_consume_clariprint_quote_budget('member', 'user:e10-bcp0b-race')$sql$
  ) as t(result boolean);

  -- Session B : ENVOI ASYNCHRONE (dblink_send_query) — elle bloque
  -- REELLEMENT sur `for update` (verrou tenu par A, non commite), SANS
  -- bloquer cette session orchestratrice.
  perform extensions.dblink_exec('race_b', 'begin');
  perform extensions.dblink_exec('race_b', 'set local role service_role');
  perform extensions.dblink_send_query(
    'race_b',
    $sql$select allowed from public.api_consume_clariprint_quote_budget('member', 'user:e10-bcp0b-race')$sql$
  );

  -- Laisse B atteindre reellement son attente sur le verrou (elle ne peut
  -- pas avoir progresse plus loin : A tient le verrou depuis l appel
  -- synchrone ci-dessus, AVANT ce sleep).
  perform pg_sleep(0.5);

  -- A commite SEULEMENT MAINTENANT : le verrou se libere, B (bloquee sur
  -- `for update`) peut alors relire — sous attente de verrou puis lecture
  -- standard READ COMMITTED — la version la PLUS RECENTE COMMITEE (celle
  -- que A vient de poser), jamais celle vue avant ce commit.
  perform extensions.dblink_exec('race_a', 'commit');

  select result into v_allowed_b from extensions.dblink_get_result('race_b') as t(result boolean);
  perform extensions.dblink_get_result('race_b');
  perform extensions.dblink_exec('race_b', 'commit');

  perform extensions.dblink_disconnect('race_a');
  perform extensions.dblink_disconnect('race_b');

  if (v_allowed_a is true and v_allowed_b is true) or (v_allowed_a is false and v_allowed_b is false) then
    raise exception 'A une unite du plafond, EXACTEMENT un appel concurrent aurait du etre accepte (a=%, b=%)', v_allowed_a, v_allowed_b;
  end if;

  select hits into v_hits
    from public.api_rate_limit_counters
   where scope = 'clariprint_quote_member' and key_hash = 'user:e10-bcp0b-race';
  if v_hits <> 2 then
    raise exception 'Le compteur aurait du valoir exactement le plafond (2) apres la course, vaut %', v_hits;
  end if;

  delete from public.api_rate_limit_counters where key_hash = 'user:e10-bcp0b-race';
  update public.api_rate_limits set max_hits = 120 where scope = 'clariprint_quote_member';
exception
  when others then
    begin
      perform extensions.dblink_disconnect('race_a');
    exception when others then null;
    end;
    begin
      perform extensions.dblink_disconnect('race_b');
    exception when others then null;
    end;
    delete from public.api_rate_limit_counters where key_hash = 'user:e10-bcp0b-race';
    update public.api_rate_limits set max_hits = 120 where scope = 'clariprint_quote_member';
    raise;
end;
$$;

drop table e10_bcp0b_race_context;
