-- ============================================================================
-- E10.22d — pilotage PAR ESPACE de la purge automatique des fichiers de
-- commande. Migration : `20260911000000`. Contrat :
-- docs/api/CONVENTIONS.md §8.22bis.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : le CHECK, le
-- trigger d activation et les quatre fonctions `create or replace` vivent
-- ENTIEREMENT dans la migration -- relire son texte ne prouve pas qu ils se
-- comportent correctement sous appel reel, en particulier le CAS LIMITE
-- explicitement demande : un tenant avec des fichiers deja a J+35 (deja
-- purgeables en theorie) qui ACTIVE le reglage aujourd hui ne doit voir
-- AUCUNE purge avant trente jours, MEME si purge_at est deja tres depasse et
-- MEME si les deux rappels sont deja confirmes.
--
-- Scenarios :
--   A. Coherence par CHECK, pas par discipline applicative (regle db.md) :
--      trigger d activation DESACTIVE, une ligne "armee sans date d armement"
--      (ou l inverse) est refusee par la base elle-meme.
--   B. Trigger commercial_settings_track_purge_activation : etat initial
--      (false/null) ; activation pose enabled_at ; RE-activer un reglage
--      DEJA actif NE REPOUSSE PAS le plancher ; desactivation remet a null ;
--      REACTIVATION pose un NOUVEAU plancher, distinct du precedent (le
--      plancher se recalcule correctement -- active/desactive/reactive).
--   C. order_file_effective_purge_at : greatest(purge_at, enabled_at+30j),
--      NULL si enabled_at est NULL.
--   D. LE CAS LIMITE PRESCRIT : tenant a J+35, active AUJOURD HUI, LES DEUX
--      rappels DEJA confirmes delivres (le piege des "deux courriels le meme
--      matin") -- api_claim_order_files_for_purge ne purge RIEN, le fichier
--      reste vivant.
--   E. Jointure INTERNE (reserve (i) fermee) : un tenant SANS ligne de
--      reglages (jamais ouvert l ecran), PUIS un tenant EXPLICITEMENT
--      desactive (ligne existe, enabled=false) -- aucun rappel, aucune
--      purge, dans les DEUX cas, MEME avec un destinataire joignable et un
--      fichier tres echu.
--   F. Reclamation REELLE pour un tenant ARME de longue date (plancher non
--      contraignant, le comportement E10.22a "normal" continue de
--      fonctionner via le nouveau chemin de code).
--   G. VIVACITE (api_reset_stale_order_file_purge_notices) : un pointeur
--      vers un rappel CREE AVANT l activation courante est remis a NULL ;
--      un pointeur vers un rappel CREE APRES ne l est PAS ; un tenant
--      DESACTIVE n est jamais touche.
--   H. api_count_blocked_order_file_purges : cinquieme motif
--      `purge_desactivee` pour un espace desarme avec un fichier echu.
--   I. Privileges : authenticated/anon refuses sur
--      api_reset_stale_order_file_purge_notices, service_role seul.
--   J. RLS (etanchéité inter-tenant) inchangee, EXERCEE sur les colonnes
--      NEUVES : un membre d un tenant etranger ne lit ni n ecrit
--      order_file_purge_enabled d un autre tenant.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

-- ── Fixture partagee : un tenant + une commande + UN fichier a purge_at
-- ARBITRAIRE (jamais derive de deposited_at, pour rendre les scenarios de
-- seuil DETERMINISTES) ────────────────────────────────────────────────────
create or replace function pg_temp.e10_22d_seed(
  p_slug text,
  p_purge_at timestamptz,
  out o_tenant_id uuid,
  out o_order_id uuid,
  out o_file_id uuid
)
language plpgsql
as $fn$
declare
  v_customer_id uuid;
  v_project_id uuid;
  v_item_id uuid;
  v_quote_id uuid;
  v_suffix text := substr(md5(p_slug || clock_timestamp()::text), 1, 6);
begin
  insert into public.tenants (slug, name) values (p_slug, p_slug) returning id into o_tenant_id;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (o_tenant_id, 'company', p_slug || ' client', '73282932000074') returning id into v_customer_id;
  insert into public.projects (tenant_id, customer_id, name)
    values (o_tenant_id, v_customer_id, p_slug || ' projet') returning id into v_project_id;
  insert into public.project_items (project_id, label, position)
    values (v_project_id, 'Item', 0) returning id into v_item_id;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (o_tenant_id, v_customer_id, v_project_id, 'DEV-2026-' || v_suffix, 'draft', '2099-01-01', true)
    returning id into v_quote_id;
  insert into public.commercial_quote_lines (
    quote_id, project_item_id, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
  ) values (v_quote_id, v_item_id, 'Ligne', 1, 0, 5, 5, 5, 0, 5, '[{"label":"production"}]'::jsonb);
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax
  ) values (o_tenant_id, v_customer_id, v_quote_id, 'CDE-2026-' || v_suffix, 'validated', 'sent',
            5, 0, null, 5, 0.2, null, 1, 6)
  returning id into o_order_id;

  o_file_id := gen_random_uuid();
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at)
    values (o_file_id, o_order_id, 'f.pdf', 'application/pdf', 100,
            o_tenant_id::text || '/' || o_order_id::text || '/' || o_file_id::text, p_purge_at);
end;
$fn$;

create or replace function pg_temp.e10_22d_add_admin(p_tenant_id uuid, p_email text, out o_user_id uuid)
language plpgsql
as $fn$
begin
  o_user_id := gen_random_uuid();
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (o_user_id, p_email, 'x', now(), now(), now(), 'authenticated', 'authenticated');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (p_tenant_id, o_user_id, 'admin', 'magrit_full', '{}');
end;
$fn$;

-- ── A — coherence par CHECK, trigger DESACTIVE (defense en profondeur) ─────
do $$
begin
  alter table public.commercial_settings disable trigger commercial_settings_track_purge_activation;

  begin
    insert into public.commercial_settings (tenant_id, order_file_purge_enabled, order_file_purge_enabled_at)
      values (gen_random_uuid(), true, null);
    raise exception 'scenario A : enabled=true/enabled_at=null aurait du violer le CHECK (trigger desactive)';
  exception
    when check_violation then
      raise notice 'scenario A (check true/null refuse) OK';
  end;

  begin
    insert into public.commercial_settings (tenant_id, order_file_purge_enabled, order_file_purge_enabled_at)
      values (gen_random_uuid(), false, now());
    raise exception 'scenario A : enabled=false/enabled_at NOT NULL aurait du violer le CHECK (trigger desactive)';
  exception
    when check_violation then
      raise notice 'scenario A (check false/not-null refuse) OK';
  end;

  alter table public.commercial_settings enable trigger commercial_settings_track_purge_activation;
end;
$$;

-- ── B — trigger d activation : pose/repose/remise a zero/RE-pose ───────────
do $$
declare
  v_tenant uuid;
  v_t0 timestamptz;
  v_t1 timestamptz;
  v_t2 timestamptz;
begin
  insert into public.tenants (slug, name) values ('e10-22d-trigger', 'E10.22d Trigger') returning id into v_tenant;

  -- Etat initial implicite (comme api_get_commercial_settings) : defaut false/null.
  insert into public.commercial_settings (tenant_id) values (v_tenant);
  if exists (
    select 1 from public.commercial_settings
     where tenant_id = v_tenant and (order_file_purge_enabled or order_file_purge_enabled_at is not null)
  ) then
    raise exception 'scenario B : etat initial attendu enabled=false/enabled_at=null';
  end if;

  update public.commercial_settings set order_file_purge_enabled = true where tenant_id = v_tenant;
  select order_file_purge_enabled_at into v_t0 from public.commercial_settings where tenant_id = v_tenant;
  if v_t0 is null then raise exception 'scenario B : activation doit poser enabled_at'; end if;

  perform pg_sleep(0.01);
  update public.commercial_settings set order_file_purge_enabled = true where tenant_id = v_tenant;
  select order_file_purge_enabled_at into v_t1 from public.commercial_settings where tenant_id = v_tenant;
  if v_t1 <> v_t0 then
    raise exception 'scenario B : re-activer un reglage DEJA actif a repousse le plancher (% -> %)', v_t0, v_t1;
  end if;

  update public.commercial_settings set order_file_purge_enabled = false where tenant_id = v_tenant;
  if (select order_file_purge_enabled_at from public.commercial_settings where tenant_id = v_tenant) is not null then
    raise exception 'scenario B : desactivation doit remettre enabled_at a NULL';
  end if;

  perform pg_sleep(0.01);
  update public.commercial_settings set order_file_purge_enabled = true where tenant_id = v_tenant;
  select order_file_purge_enabled_at into v_t2 from public.commercial_settings where tenant_id = v_tenant;
  if v_t2 is null or v_t2 = v_t0 then
    raise exception 'scenario B : reactivation doit poser un NOUVEAU plancher, distinct du precedent (% vs %)', v_t2, v_t0;
  end if;

  raise notice 'scenario B (activation/reactivation, plancher recalcule correctement) OK';
end;
$$;

-- ── C — order_file_effective_purge_at ──────────────────────────────────────
do $$
declare
  v_enabled_at timestamptz := now();
begin
  if public.order_file_effective_purge_at(now() - interval '35 days', v_enabled_at) <> v_enabled_at + interval '30 days' then
    raise exception 'scenario C : effective attendu enabled_at+30j quand purge_at est tres depasse';
  end if;
  if public.order_file_effective_purge_at(now() + interval '60 days', v_enabled_at) <> now() + interval '60 days' then
    raise exception 'scenario C : effective attendu purge_at quand il domine deja le plancher';
  end if;
  if public.order_file_effective_purge_at(now(), null) is not null then
    raise exception 'scenario C : effective doit etre NULL si enabled_at est NULL';
  end if;
  raise notice 'scenario C (order_file_effective_purge_at) OK';
end;
$$;

-- ── D — LE CAS LIMITE PRESCRIT : J+35, active aujourd hui, DEUX rappels
-- DEJA confirmes -- AUCUNE purge avant le plancher ─────────────────────────
do $$
declare
  v_seed record;
  v_tenant uuid;
  v_file uuid;
  v_notice1 uuid;
  v_notice2 uuid;
  v_n integer;
begin
  select * into v_seed from pg_temp.e10_22d_seed('e10-22d-floor', now() - interval '35 days');
  v_tenant := v_seed.o_tenant_id;
  v_file := v_seed.o_file_id;

  -- Activation AUJOURD HUI sur un fichier deja a J+35 (deja purgeable en
  -- theorie selon purge_at BRUT).
  insert into public.commercial_settings (tenant_id, order_file_purge_enabled) values (v_tenant, true);

  -- LES DEUX rappels DEJA confirmes DELIVRES -- le piege identifie par l
  -- architecte (deux courriels le meme matin, purge sous 48h) : meme dans
  -- ces conditions, api_claim_order_files_for_purge ne doit RIEN detruire
  -- avant order_file_purge_effective_from.
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count, confirmed_at)
    values (v_tenant, 'first', now() + interval '30 days', 1, 1, now()) returning id into v_notice1;
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count, confirmed_at)
    values (v_tenant, 'second', now() + interval '30 days', 1, 1, now()) returning id into v_notice2;
  update public.commercial_order_files
     set purge_notice_1_id = v_notice1, purge_notice_2_id = v_notice2
   where id = v_file;

  select count(*) into v_n from public.api_claim_order_files_for_purge(500) where purged_file_id = v_file;
  if v_n <> 0 then
    raise exception 'scenario D : le fichier a ete PURGE malgre le plancher d activation -- le piege des 48h n est PAS ferme';
  end if;
  if (select deleted_at from public.commercial_order_files where id = v_file) is not null then
    raise exception 'scenario D : le fichier ne doit PAS etre marque supprime avant le plancher';
  end if;
  if (select purged_at from public.commercial_order_files where id = v_file) is not null then
    raise exception 'scenario D : purged_at ne doit PAS etre pose avant le plancher';
  end if;

  raise notice 'scenario D (plancher d activation ferme le piege des 48h, meme rappels confirmes) OK';
end;
$$;

-- ── E — jointure INTERNE : tenant SANS ligne, PUIS EXPLICITEMENT desactive
-- -- aucun rappel, aucune purge, MEME avec destinataire et fichier tres echu ─
do $$
declare
  v_seed record;
  v_tenant uuid;
  v_file uuid;
  v_n integer;
begin
  select * into v_seed from pg_temp.e10_22d_seed('e10-22d-disabled', now() - interval '40 days');
  v_tenant := v_seed.o_tenant_id;
  v_file := v_seed.o_file_id;
  perform pg_temp.e10_22d_add_admin(v_tenant, 'e10-22d-disabled-admin@example.test');

  -- AUCUNE ligne commercial_settings pour ce tenant (jamais ouvert l ecran).
  select count(*) into v_n from public.api_claim_order_file_purge_notices('first', 20) where claimed_tenant_id = v_tenant;
  if v_n <> 0 then raise exception 'scenario E : tenant SANS ligne de reglages ne doit produire AUCUN rappel'; end if;
  if (select purge_notice_1_id from public.commercial_order_files where id = v_file) is not null then
    raise exception 'scenario E : le fichier ne doit porter aucun rattachement (tenant sans ligne)';
  end if;
  select count(*) into v_n from public.api_claim_order_files_for_purge(500) where purged_file_id = v_file;
  if v_n <> 0 then raise exception 'scenario E : tenant SANS ligne de reglages ne doit JAMAIS etre purge'; end if;

  -- Ligne EXPLICITEMENT desactivee : meme resultat.
  insert into public.commercial_settings (tenant_id, order_file_purge_enabled) values (v_tenant, false);
  select count(*) into v_n from public.api_claim_order_file_purge_notices('first', 20) where claimed_tenant_id = v_tenant;
  if v_n <> 0 then raise exception 'scenario E : tenant enabled=false ne doit produire AUCUN rappel'; end if;
  select count(*) into v_n from public.api_claim_order_files_for_purge(500) where purged_file_id = v_file;
  if v_n <> 0 then raise exception 'scenario E : tenant enabled=false ne doit JAMAIS etre purge'; end if;

  raise notice 'scenario E (jointure interne exclut tenant sans ligne / desactive) OK';
end;
$$;

-- ── F — reclamation REELLE pour un tenant ARME de longue date (plancher non
-- contraignant -- le comportement E10.22a "normal" continue de fonctionner
-- via le nouveau chemin de code) ────────────────────────────────────────────
do $$
declare
  v_seed record;
  v_tenant uuid;
  v_file uuid;
  v_n integer;
begin
  -- purge_at a J+18 : proche du palier FIRST (lead=20), PAS du palier SECOND
  -- (lead=15).
  select * into v_seed from pg_temp.e10_22d_seed('e10-22d-armed-old', now() + interval '18 days');
  v_tenant := v_seed.o_tenant_id;
  v_file := v_seed.o_file_id;
  perform pg_temp.e10_22d_add_admin(v_tenant, 'e10-22d-armed-old-admin@example.test');

  -- ARME il y a 40 jours : enabled_at+30j = J-10, DOMINE par purge_at (J+18)
  -- -- le plancher ne joue plus aucun role ici, seul purge_at BRUT gouverne,
  -- exactement comme avant E10.22d. qa-review round 1 (B1) : le trigger
  -- n honore plus aucune valeur fournie a l INSERT -- desarme le temps de
  -- cette seule instruction pour construire legitimement ce passe.
  alter table public.commercial_settings disable trigger commercial_settings_track_purge_activation;
  insert into public.commercial_settings (tenant_id, order_file_purge_enabled, order_file_purge_enabled_at)
    values (v_tenant, true, now() - interval '40 days');
  alter table public.commercial_settings enable trigger commercial_settings_track_purge_activation;

  select count(*) into v_n from public.api_claim_order_file_purge_notices('first', 20) where claimed_tenant_id = v_tenant;
  if v_n <> 1 then raise exception 'scenario F : palier first attendu reclame (1 rappel), obtenu %', v_n; end if;
  if (select purge_notice_1_id from public.commercial_order_files where id = v_file) is null then
    raise exception 'scenario F : le fichier doit porter un rappel de palier first';
  end if;

  select count(*) into v_n from public.api_claim_order_file_purge_notices('second', 15) where claimed_tenant_id = v_tenant;
  if v_n <> 0 then raise exception 'scenario F : palier second NON atteint, attendu 0 rappel, obtenu %', v_n; end if;

  raise notice 'scenario F (reclamation reelle, plancher non contraignant pour une activation ancienne) OK';
end;
$$;

-- ── G — VIVACITE : pointeur vers un rappel ANTERIEUR a l activation remis a
-- NULL ; pointeur vers un rappel POSTERIEUR conserve ; tenant DESACTIVE
-- jamais touche ────────────────────────────────────────────────────────────
do $$
declare
  v_seed_reset record;
  v_seed_off record;
  v_tenant uuid;
  v_file uuid;
  v_stale_notice uuid;
  v_fresh_notice uuid;
  v_tenant_off uuid;
  v_file_off uuid;
  v_stale_notice_off uuid;
  v_enabled_at timestamptz;
  v_reset_count integer;
begin
  select * into v_seed_reset from pg_temp.e10_22d_seed('e10-22d-reset', now() + interval '5 days');
  v_tenant := v_seed_reset.o_tenant_id;
  v_file := v_seed_reset.o_file_id;

  -- Rappel CREE AVANT l activation (simule une activation passee, deja
  -- desarmee) -- rattache au SEUL pointeur first pour ce fichier.
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count, created_at)
    values (v_tenant, 'first', now(), 1, 1, now() - interval '10 days')
    returning id into v_stale_notice;
  update public.commercial_order_files set purge_notice_1_id = v_stale_notice where id = v_file;

  -- ARME MAINTENANT : enabled_at POSTERIEUR au rappel ci-dessus.
  insert into public.commercial_settings (tenant_id, order_file_purge_enabled) values (v_tenant, true);
  select order_file_purge_enabled_at into v_enabled_at from public.commercial_settings where tenant_id = v_tenant;
  if not (v_stale_notice in (
    select id from public.commercial_order_file_purge_notices where created_at < v_enabled_at
  )) then
    raise exception 'scenario G : fixture invalide -- le rappel devrait etre ANTERIEUR a l activation';
  end if;

  -- Rappel FRAIS, CREE APRES l activation -- rattache au pointeur SECOND du
  -- MEME fichier, ne doit JAMAIS etre touche par la remise a zero.
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count)
    values (v_tenant, 'second', now(), 1, 1)
    returning id into v_fresh_notice;
  update public.commercial_order_files set purge_notice_2_id = v_fresh_notice where id = v_file;

  -- Tenant DESACTIVE, MEME configuration (pointeur perime) -- ne doit JAMAIS
  -- etre touche par la fonction (jointure interne, filtre order_file_purge_enabled).
  select * into v_seed_off from pg_temp.e10_22d_seed('e10-22d-reset-off', now() + interval '5 days');
  v_tenant_off := v_seed_off.o_tenant_id;
  v_file_off := v_seed_off.o_file_id;
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count, created_at)
    values (v_tenant_off, 'first', now(), 1, 1, now() - interval '10 days')
    returning id into v_stale_notice_off;
  update public.commercial_order_files set purge_notice_1_id = v_stale_notice_off where id = v_file_off;
  insert into public.commercial_settings (tenant_id, order_file_purge_enabled) values (v_tenant_off, false);

  select public.api_reset_stale_order_file_purge_notices() into v_reset_count;
  if v_reset_count < 1 then
    raise exception 'scenario G : au moins un fichier attendu remis a zero (tenant arme), obtenu %', v_reset_count;
  end if;

  if (select purge_notice_1_id from public.commercial_order_files where id = v_file) is not null then
    raise exception 'scenario G : le pointeur PERIME (rappel anterieur a l activation) aurait du etre remis a NULL';
  end if;
  if (select purge_notice_2_id from public.commercial_order_files where id = v_file) <> v_fresh_notice then
    raise exception 'scenario G : le pointeur FRAIS (rappel posterieur a l activation) ne doit JAMAIS etre touche';
  end if;
  if (select purge_notice_1_id from public.commercial_order_files where id = v_file_off) is distinct from v_stale_notice_off then
    raise exception 'scenario G : un tenant DESACTIVE ne doit JAMAIS voir ses pointeurs touches par la vivacite';
  end if;

  raise notice 'scenario G (vivacite -- reset des rappels perimes, tenant desactive epargne) OK';
end;
$$;

-- ── H — api_count_blocked_order_file_purges : cinquieme motif
-- `purge_desactivee` ────────────────────────────────────────────────────────
do $$
declare
  v_seed record;
  v_tenant uuid;
  v_reason text;
  v_count integer;
begin
  select * into v_seed from pg_temp.e10_22d_seed('e10-22d-blocked-off', now() - interval '2 days');
  v_tenant := v_seed.o_tenant_id;
  insert into public.commercial_settings (tenant_id, order_file_purge_enabled) values (v_tenant, false);

  select blocked_reason, blocked_count into v_reason, v_count
    from public.api_count_blocked_order_file_purges()
   where blocked_tenant_id = v_tenant;

  if v_reason is distinct from 'purge_desactivee' or v_count <> 1 then
    raise exception 'scenario H : attendu motif purge_desactivee/count=1, obtenu %/%', v_reason, v_count;
  end if;

  raise notice 'scenario H (motif purge_desactivee) OK';
end;
$$;

-- ── I — privileges : authenticated/anon refuses ────────────────────────────
do $$
declare
  v_denied boolean := false;
begin
  set local role authenticated;
  begin
    perform public.api_reset_stale_order_file_purge_notices();
  exception when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then raise exception 'scenario I : authenticated a pu executer api_reset_stale_order_file_purge_notices'; end if;

  v_denied := false;
  set local role anon;
  begin
    perform public.api_reset_stale_order_file_purge_notices();
  exception when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then raise exception 'scenario I : anon a pu executer api_reset_stale_order_file_purge_notices'; end if;

  raise notice 'scenario I (privileges, authenticated/anon refuses) OK';
end;
$$;

-- ── J — RLS (etancheite inter-tenant) sur les colonnes NEUVES, policies
-- INCHANGEES par ce lot ─────────────────────────────────────────────────────
create temporary table e10_22d_rls_context (
  tenant_a uuid not null,
  tenant_b uuid not null,
  member_a uuid not null,
  member_b uuid not null
);
grant select on e10_22d_rls_context to authenticated;

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_member_a uuid;
  v_member_b uuid;
begin
  insert into public.tenants (slug, name) values ('e10-22d-rls-a', 'E10.22d RLS A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-22d-rls-b', 'E10.22d RLS B') returning id into v_tenant_b;
  select o_user_id into v_member_a from pg_temp.e10_22d_add_admin(v_tenant_a, 'e10-22d-rls-a@example.test');
  select o_user_id into v_member_b from pg_temp.e10_22d_add_admin(v_tenant_b, 'e10-22d-rls-b@example.test');

  insert into public.commercial_settings (tenant_id, order_file_purge_enabled) values (v_tenant_a, true);
  insert into public.commercial_settings (tenant_id, order_file_purge_enabled) values (v_tenant_b, false);

  insert into e10_22d_rls_context (tenant_a, tenant_b, member_a, member_b) values (v_tenant_a, v_tenant_b, v_member_a, v_member_b);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select member_b::text from e10_22d_rls_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
begin
  select tenant_a into v_tenant_a from e10_22d_rls_context;

  if exists (select 1 from public.commercial_settings where tenant_id = v_tenant_a) then
    raise exception 'scenario J : un membre du tenant B lit les reglages (order_file_purge_enabled compris) du tenant A';
  end if;

  -- RLS d ecriture (`commercial_settings_write`, INCHANGEE par ce lot) :
  -- la ligne du tenant A est INVISIBLE sous cette identite -- l UPDATE
  -- n affecte donc AUCUNE ligne, sans lever d exception (comportement SQL
  -- normal d une policy RLS, distinct du 403 applicatif que PostgREST
  -- construirait par-dessus).
  update public.commercial_settings set order_file_purge_enabled = false where tenant_id = v_tenant_a;
end;
$$;

reset role;

do $$
declare
  v_tenant_a uuid;
begin
  select tenant_a into v_tenant_a from e10_22d_rls_context;
  if (select order_file_purge_enabled from public.commercial_settings where tenant_id = v_tenant_a) is distinct from true then
    raise exception 'scenario J : un membre du tenant B a pu MODIFIER order_file_purge_enabled du tenant A';
  end if;
  raise notice 'scenario J (etancheite inter-tenant sur les colonnes neuves) OK';
end;
$$;

rollback;
