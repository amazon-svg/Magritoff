-- ============================================================================
-- E10.18d — FILET DE REPRISE des exports comptables TUES par le
-- superviseur (CPU, pas memoire). Migration
-- `20260913010000_gescom_e10_18d_order_export_recovery_net.sql`, qui
-- etend `api_claim_order_exports` (create or replace, N EDITE JAMAIS
-- `20260913000000`). Contrat : docs/api/CONVENTIONS.md §8.24, point 4
-- (douzieme entree du bandeau, condition 3) et treizieme entree, point (iv).
-- ----------------------------------------------------------------------------
-- CE QUE CE FICHIER PROUVE :
--   1. Une ligne `running` VIEILLE de plus de 15 minutes (started_at a
--      16 minutes) passe `failed` au tour suivant de `api_claim_order_exports`,
--      avec `completed_at` pose, `error_code = order_export.generation_failed`
--      et `error_detail` PREFIXE `order_export_interrupted:`.
--   2. Une ligne `running` RECENTE (started_at a 1 minute) reste
--      PARFAITEMENT INTACTE (statut, attempts, started_at inchanges).
--   3. AUCUNE ligne d un AUTRE statut (`pending`, `ready`, `failed`,
--      `expired`) n est touchee par le balayage, MEME artificiellement
--      vieille sur une colonne de date non pertinente.
--   4. Le plafond de TROIS demandes non terminees par acteur
--      (`order_export.pending_limit_reached`) est LIBERE par le passage a
--      `failed` : une quatrieme demande, refusee AVANT le balayage,
--      redevient possible APRES.
--   5. Defense en profondeur, et c est le motif du choix `failed` plutot
--      que `pending` : le trigger d immuabilite
--      (`commercial_order_exports_reject_mutation()`, INCHANGE par cette
--      migration) REFUSE un retour `running -> pending` qui ne porterait
--      pas un `attempts` strictement croissant.
--
-- MUTATION EXECUTEE PENDANT LE DEVELOPPEMENT DE CE LOT (voir le rapport de
-- fin de story pour le detail) : en retirant temporairement le bloc
-- `with stuck as (...) update ...` de `api_claim_order_exports` (function
-- remise a la version de `20260913000000`), les scenarios 1 et 4
-- ECHOUENT (`raise exception`), ce qui ANNULE la transaction ouverte par
-- ce fichier (`begin;` en tete, aucun `commit;`) — la preuve demandee que
-- ce test TOMBE si le balayage est retire de la fonction.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre), ou
-- individuellement :
--   docker exec -i supabase_db_magritoff-v5 psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
--     < tests/sql/gescom-e10-18d-order-export-recovery-net.sql
-- ============================================================================

begin;

create temporary table e10_18d_context (
  tenant_a uuid not null,
  actor_a  uuid not null
);

do $$
declare
  v_tenant_a uuid;
  v_actor_a uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_actor_a, 'e10-18d-actor-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-18d-recovery-net', 'E10.18d Recovery Net')
    returning id into v_tenant_a;

  -- admin : porte `can_export_orders` par derivation d appartenance (UM1),
  -- necessaire pour `api_request_order_export` (scenario 4).
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_a, 'admin', 'magrit_full', '{}');

  insert into e10_18d_context (tenant_a, actor_a) values (v_tenant_a, v_actor_a);
end;
$$;

-- ── 1 — ligne `running` VIEILLE (16 minutes) -> `failed`, detail PREFIXE ────
do $$
declare
  v_tenant_a uuid;
  v_stuck_id uuid;
  v_status text;
  v_completed_at timestamptz;
  v_error_code text;
  v_error_detail text;
begin
  select tenant_a into v_tenant_a from e10_18d_context;

  insert into public.commercial_order_exports (
    tenant_id, status, format, granularity, filters, attempts, started_at, next_attempt_at
  ) values (
    v_tenant_a, 'running', 'csv', 'order', '{}'::jsonb, 1, now() - interval '16 minutes', now() + interval '1 minute'
  ) returning id into v_stuck_id;

  set local role service_role;
  perform public.api_claim_order_exports(5, 3, interval '15 minutes');
  reset role;

  select status, completed_at, error_code, error_detail
    into v_status, v_completed_at, v_error_code, v_error_detail
    from public.commercial_order_exports
   where id = v_stuck_id;

  if v_status <> 'failed' then
    raise exception 'scenario 1 (BLOQUANT) : une ligne running vieille de 16 minutes aurait du passer failed, obtenu %', v_status;
  end if;
  if v_completed_at is null then
    raise exception 'scenario 1 : completed_at aurait du etre pose par le filet de reprise';
  end if;
  if v_error_code <> 'order_export.generation_failed' then
    raise exception 'scenario 1 : error_code attendu order_export.generation_failed, obtenu %', v_error_code;
  end if;
  if v_error_detail is null or v_error_detail !~ '^order_export_interrupted:' then
    raise exception 'scenario 1 : error_detail aurait du etre prefixe order_export_interrupted:, obtenu %', v_error_detail;
  end if;

  raise notice 'scenario 1 (filet de reprise — ligne running vieille passe failed) OK';
end;
$$;

-- ── 2 — ligne `running` RECENTE (1 minute) -> INTACTE ───────────────────────
do $$
declare
  v_tenant_a uuid;
  v_recent_id uuid;
  v_status text;
  v_attempts integer;
  v_started_at timestamptz;
  v_started_at_before timestamptz := now() - interval '1 minute';
begin
  select tenant_a into v_tenant_a from e10_18d_context;

  insert into public.commercial_order_exports (
    tenant_id, status, format, granularity, filters, attempts, started_at, next_attempt_at
  ) values (
    v_tenant_a, 'running', 'csv', 'order', '{}'::jsonb, 1, v_started_at_before, now() + interval '1 minute'
  ) returning id into v_recent_id;

  set local role service_role;
  perform public.api_claim_order_exports(5, 3, interval '15 minutes');
  reset role;

  select status, attempts, started_at into v_status, v_attempts, v_started_at
    from public.commercial_order_exports
   where id = v_recent_id;

  if v_status <> 'running' then
    raise exception 'scenario 2 (BLOQUANT) : une ligne running RECENTE (1 minute) a ete touchee, statut obtenu %', v_status;
  end if;
  if v_attempts <> 1 then
    raise exception 'scenario 2 : attempts d une ligne running recente n aurait pas du changer, obtenu %', v_attempts;
  end if;
  if v_started_at <> v_started_at_before then
    raise exception 'scenario 2 : started_at d une ligne running recente n aurait pas du changer';
  end if;

  raise notice 'scenario 2 (ligne running recente intacte) OK';
end;
$$;

-- ── 3 — AUCUNE ligne d un AUTRE statut n est touchee ─────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_pending_id uuid;
  v_ready_id uuid;
  v_failed_id uuid;
  v_expired_id uuid;
  v_pending_status text;
  v_ready_status text;
  v_failed_status text;
  v_expired_status text;
begin
  select tenant_a into v_tenant_a from e10_18d_context;

  -- `pending`, AVEC UN `started_at` DEJA ANCIEN (20 minutes) — etat un peu
  -- artificiel pour une ligne `pending` (`started_at` n est normalement
  -- pose QUE par la reclamation, au moment ou une ligne devient `running`),
  -- mais c est PRECISEMENT ce qui rend ce scenario capable de DETECTER une
  -- regression du FILTRE `status = 'running'` du balayage : SANS ce
  -- filtre, cette ligne (vieille sur `started_at`) serait balayee elle
  -- aussi et passerait `failed`. AVEC le filtre (code correct), elle est
  -- totalement ignoree par le balayage, quel que soit `started_at`.
  -- `requested_at = now()` : fraiche pour la reclamation NORMALE
  -- (INCHANGEE par ce lot, deja testee ailleurs — E10.18c scenario 4a) —
  -- SANS IMPORTANCE pour CE scenario : sur une base PARTAGEE, d autres
  -- lignes `pending` deja dues pourraient occuper les 5 places de
  -- `api_claim_order_exports(5, ...)` avant la notre (triee par date de
  -- demande) et la laisser `pending` — c est un resultat LEGITIME de la
  -- reclamation normale, PAS une regression de ce lot (qa-review round 3,
  -- mineur 3). Le controle ci-dessous est donc CIBLE sur ce que CE lot
  -- doit garantir (jamais `pending -> failed` par LE BALAYAGE), pas sur le
  -- resultat de la reclamation normale, dont l issue depend de donnees
  -- HORS de notre controle sur une base partagee.
  insert into public.commercial_order_exports (tenant_id, status, format, granularity, filters, requested_at, next_attempt_at, started_at)
    values (v_tenant_a, 'pending', 'csv', 'order', '{}'::jsonb, now(), now(), now() - interval '20 minutes')
    returning id into v_pending_id;
  insert into public.commercial_order_exports (tenant_id, status, format, granularity, filters, started_at, completed_at, row_count, storage_path, file_name, byte_size, sha256, content_type, expires_at)
    values (v_tenant_a, 'ready', 'csv', 'order', '{}'::jsonb, now() - interval '1 hour', now() - interval '1 hour',
            0, v_tenant_a::text || '/e10-18d-ready.csv', 'e10-18d-ready.csv', 10,
            repeat('a', 64), 'text/csv', now() - interval '1 hour')
    returning id into v_ready_id;
  insert into public.commercial_order_exports (tenant_id, status, format, granularity, filters, started_at, completed_at, error_code, error_detail)
    values (v_tenant_a, 'failed', 'csv', 'order', '{}'::jsonb, now() - interval '1 hour', now() - interval '1 hour',
            'order_export.generation_failed', 'un echec ANTERIEUR, sans rapport avec ce filet')
    returning id into v_failed_id;
  insert into public.commercial_order_exports (tenant_id, status, format, granularity, filters, started_at, completed_at, expires_at)
    values (v_tenant_a, 'expired', 'csv', 'order', '{}'::jsonb, now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 minute')
    returning id into v_expired_id;

  set local role service_role;
  perform public.api_claim_order_exports(5, 3, interval '15 minutes');
  reset role;

  select status into v_pending_status from public.commercial_order_exports where id = v_pending_id;
  select status into v_ready_status from public.commercial_order_exports where id = v_ready_id;
  select status into v_failed_status from public.commercial_order_exports where id = v_failed_id;
  select status into v_expired_status from public.commercial_order_exports where id = v_expired_id;

  -- CONTROLE CIBLE, INDEPENDANT DES DONNEES EXISTANTES (qa-review round 3,
  -- mineur 3) : `pending` OU `running` sont TOUS DEUX des resultats
  -- LEGITIMES de la reclamation NORMALE (inchangee, qui peut ou non
  -- reclamer cette ligne selon ce qu une base PARTAGEE contient deja) — ce
  -- que CE lot garantit, et SEULEMENT cela, c est que LE BALAYAGE ne fait
  -- JAMAIS passer une ligne `pending` a `failed` (il ne lit que
  -- `status = 'running'`). `failed`/`expired` seraient donc la SEULE
  -- preuve d une regression du filtre — et c est exactement ce que la
  -- mutation « filtre status retiro » (voir rapport de fin de story) fait
  -- tomber : cette ligne a un `started_at` DELIBEREMENT vieux de 20
  -- minutes (voir l insertion ci-dessus), donc SANS le filtre elle
  -- deviendrait `failed`.
  if v_pending_status not in ('pending', 'running') then
    raise exception 'scenario 3 (BLOQUANT) : une ligne pending est devenue % — LE BALAYAGE ne doit JAMAIS toucher une ligne qui n est pas running', v_pending_status;
  end if;
  if v_ready_status <> 'ready' then
    raise exception 'scenario 3 (BLOQUANT) : une ligne ready a ete touchee par le filet de reprise, obtenu %', v_ready_status;
  end if;
  if v_failed_status <> 'failed' then
    raise exception 'scenario 3 (BLOQUANT) : une ligne failed a ete touchee par le filet de reprise, obtenu %', v_failed_status;
  end if;
  if v_expired_status <> 'expired' then
    raise exception 'scenario 3 (BLOQUANT) : une ligne expired a ete touchee par le filet de reprise, obtenu %', v_expired_status;
  end if;
  if (select error_detail from public.commercial_order_exports where id = v_failed_id) <> 'un echec ANTERIEUR, sans rapport avec ce filet' then
    raise exception 'scenario 3 (BLOQUANT) : error_detail d une ligne failed PREEXISTANTE a ete ECRASE par le filet de reprise';
  end if;

  raise notice 'scenario 3 (aucune ligne d un autre statut touchee) OK';
end;
$$;

-- ── 4 — le plafond de trois demandes non terminees est LIBERE par le filet ──
do $$
declare
  v_tenant_a uuid;
  v_actor_a uuid;
  v_stuck_id uuid;
  v_denied_before boolean := false;
  v_denied_after boolean := false;
begin
  select tenant_a, actor_a into v_tenant_a, v_actor_a from e10_18d_context;

  -- Trois demandes DEJA "non terminees" pour cet acteur : DEUX pending
  -- fraiches (posees via l API, comme un utilisateur reel) + UNE running
  -- VIEILLE de 20 minutes (celle que le filet doit liberer).
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_a::text, 'role', 'authenticated')::text, true);
  perform public.api_request_order_export(v_tenant_a, 'csv', 'order', '{}'::jsonb);
  perform public.api_request_order_export(v_tenant_a, 'csv', 'order', '{}'::jsonb);
  reset role;

  insert into public.commercial_order_exports (
    tenant_id, status, format, granularity, filters, requested_by, requested_by_label, attempts, started_at, next_attempt_at
  ) values (
    v_tenant_a, 'running', 'csv', 'order', '{}'::jsonb, v_actor_a, 'e10-18d-actor-a@example.test', 1, now() - interval '20 minutes', now() + interval '1 minute'
  ) returning id into v_stuck_id;

  -- AVANT le balayage : le plafond de trois demandes non terminees est
  -- DEJA atteint (2 pending + 1 running) -> une quatrieme est refusee.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_a::text, 'role', 'authenticated')::text, true);
  begin
    perform public.api_request_order_export(v_tenant_a, 'csv', 'order', '{}'::jsonb);
  exception
    when others then
      if sqlerrm like '%order_export.pending_limit_reached%' then v_denied_before := true; else raise; end if;
  end;
  reset role;
  if not v_denied_before then
    raise exception 'scenario 4 : une quatrieme demande aurait du etre refusee AVANT le balayage (plafond de trois deja atteint)';
  end if;

  -- Le filet de reprise (tour de api_claim_order_exports) passe la ligne
  -- running vieille de 20 minutes en failed -> LIBERE une place dans le
  -- plafond (failed n est PAS "non termine").
  set local role service_role;
  perform public.api_claim_order_exports(5, 3, interval '15 minutes');
  reset role;

  if (select status from public.commercial_order_exports where id = v_stuck_id) <> 'failed' then
    raise exception 'scenario 4 (BLOQUANT) : la ligne running vieille de 20 minutes aurait du passer failed avant ce controle';
  end if;

  -- APRES le balayage : la MEME quatrieme demande redevient POSSIBLE.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_a::text, 'role', 'authenticated')::text, true);
  begin
    perform public.api_request_order_export(v_tenant_a, 'csv', 'order', '{}'::jsonb);
    v_denied_after := false;
  exception
    when others then
      if sqlerrm like '%order_export.pending_limit_reached%' then v_denied_after := true; else raise; end if;
  end;
  reset role;
  if v_denied_after then
    raise exception 'scenario 4 (BLOQUANT) : le plafond aurait du etre LIBERE par le passage a failed du filet de reprise, une quatrieme demande est encore refusee';
  end if;

  raise notice 'scenario 4 (plafond libere par le filet de reprise) OK';
end;
$$;

-- ── 5 — defense en profondeur : le trigger REFUSE running -> pending SANS ───
-- ── increment d attempts (c est pourquoi le filet choisit failed) ───────────
do $$
declare
  v_tenant_a uuid;
  v_row_id uuid;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_18d_context;

  insert into public.commercial_order_exports (
    tenant_id, status, format, granularity, filters, attempts, started_at, next_attempt_at
  ) values (
    v_tenant_a, 'running', 'csv', 'order', '{}'::jsonb, 1, now(), now() + interval '1 minute'
  ) returning id into v_row_id;

  begin
    update public.commercial_order_exports set status = 'pending' where id = v_row_id;
  exception
    when others then
      if sqlerrm like '%commercial_order_exports_status_transition%' then v_rejected := true; else raise; end if;
  end;

  if not v_rejected then
    raise exception 'scenario 5 (BLOQUANT) : le trigger aurait du refuser running -> pending SANS increment d attempts (c est le motif du choix de failed par le filet de reprise)';
  end if;

  raise notice 'scenario 5 (trigger refuse running -> pending sans increment d attempts) OK';
end;
$$;

rollback;
