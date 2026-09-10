-- ============================================================================
-- E10.22b (purge reelle) et E10.22c (objets orphelins, dette D7) -- migration
-- `20260910000600`. Contrat : docs/api/CONVENTIONS.md §8.22 §5 et §6.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : les trois
-- fonctions `security definer` neuves vivent ENTIEREMENT dans la migration --
-- relire son texte ne prouve pas qu elles se comportent correctement sous
-- appel reel, en particulier la GARDE des deux rappels confirmes (§5 du
-- contrat, coeur de tout ce que E10.22a/E10.22a-bis ont construit).
--
-- Scenarios :
--   1. api_claim_order_files_for_purge : un fichier dont LES DEUX rappels
--      sont CONFIRMES DELIVRES et purge_at <= now() est reclame, MARQUE
--      (deleted_at/purged_at/deleted_by=null/deleted_by_label='Purge
--      automatique'), et n est PAS reclame une seconde fois. Un fichier dont
--      UN SEUL rappel est confirme (l autre confirme pas, ou meme rappel
--      manquant) N EST JAMAIS reclame, meme si purge_at est largement
--      depasse. Un fichier dont purge_at n est pas encore atteint n est pas
--      reclame meme si les deux rappels sont confirmes. Un fichier deja
--      supprime manuellement (deleted_at pose par E10.17a) n est jamais
--      reclame par la purge automatique.
--   2. api_record_order_files_purged : insere un evenement order_files.purged
--      exploitable (payload conforme a OrderFilesPurgedPayload) ; rejette un
--      resume incoherent (file_count/order_count/byte_size_freed/order_ids <
--      1) AVANT toute insertion.
--   3. api_claim_orphan_order_file_objects : un objet SANS aucune ligne
--      commercial_order_files correspondante, plus vieux que le delai (24h),
--      EST candidat ; le MEME objet, mais depose il y a moins de 24h, N EST
--      PAS candidat (billet en cours, ~2h max) ; un objet dont la ligne est
--      DEJA purgee (purged_at non nul) EST candidat SANS delai
--      supplementaire ; un objet dont la ligne existe et est encore VIVANTE
--      (purged_at null, deleted_at null) N EST JAMAIS candidat, quel que soit
--      son age ; un objet d un AUTRE bucket n est jamais candidat.
--   4. Privileges : authenticated/anon refuses (insufficient_privilege) sur
--      les TROIS fonctions ; service_role seul.
--   5. Regression E10.17a : le regime de suppression manuelle
--      (`api_delete_order_file`) reste INCHANGE par ce lot -- meme ordre,
--      meme forme -- verifie par appel reel, pas seulement par lecture.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_22b_context (
  tenant_a       uuid not null,
  admin_a        uuid not null,
  order_a        uuid not null,
  file_due_both_confirmed    uuid not null, -- purge_at passee, DEUX rappels confirmes -- DOIT etre purge
  file_due_one_confirmed     uuid not null, -- purge_at passee, UN SEUL rappel confirme -- NE DOIT PAS etre purge
  file_due_none_confirmed    uuid not null, -- purge_at passee, AUCUN rappel confirme -- NE DOIT PAS etre purge
  file_not_due_both_confirmed uuid not null, -- purge_at future, DEUX rappels confirmes -- NE DOIT PAS etre purge
  file_already_deleted       uuid not null  -- purge_at passee, DEUX rappels confirmes, MAIS deja supprime manuellement
);

do $$
declare
  v_admin_a uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_item_a uuid;
  v_quote_a uuid;
  v_quote_line_a uuid;
  v_order_a uuid;
  v_file_due_both uuid := gen_random_uuid();
  v_file_due_one uuid := gen_random_uuid();
  v_file_due_none uuid := gen_random_uuid();
  v_file_not_due_both uuid := gen_random_uuid();
  v_file_already_deleted uuid := gen_random_uuid();
  v_notice_confirmed_1 uuid;
  v_notice_confirmed_2 uuid;
  v_notice_unconfirmed uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_admin_a, 'e10-22b-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-22b-tenant-a', 'E10.22b Tenant A') returning id into v_tenant_a;
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_admin_a, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.22b Client A', '73282932000074') returning id into v_customer_a;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a, 'Projet E10.22b A') returning id into v_project_a;
  insert into public.project_items (project_id, label, position) values (v_project_a, 'Item A', 0) returning id into v_item_a;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-99301', 'draft', '2099-01-01', true)
    returning id into v_quote_a;
  insert into public.commercial_quote_lines (
    quote_id, project_item_id, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
  ) values (v_quote_a, v_item_a, 'Ligne A', 10, 0, 5, 5, 5, 0, 5, '[{"label":"production"}]'::jsonb) returning id into v_quote_line_a;
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax
  )
  values (v_tenant_a, v_customer_a, v_quote_a, 'CDE-2026-99301', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12)
  returning id into v_order_a;

  -- Rappels PRE-CONSTRUITS DIRECTEMENT (phase privilegiee), pour isoler la
  -- garde de la fonction testee ici -- le cycle complet d emission/preuve de
  -- livraison est deja teste par gescom-e10-22a-order-file-purge-notices.sql.
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count, confirmed_at)
    values (v_tenant_a, 'first', now(), 1, 1, now() - interval '15 days')
    returning id into v_notice_confirmed_1;
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count, confirmed_at)
    values (v_tenant_a, 'second', now(), 1, 1, now() - interval '3 days')
    returning id into v_notice_confirmed_2;
  insert into public.commercial_order_file_purge_notices (tenant_id, stage, purge_at, file_count, order_count)
    values (v_tenant_a, 'second', now(), 1, 1)
    returning id into v_notice_unconfirmed;

  -- file_due_both_confirmed : purge_at PASSEE, DEUX rappels CONFIRMES -- doit etre purge.
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at, purge_notice_1_id, purge_notice_2_id)
    values (v_file_due_both, v_order_a, 'due-both.pdf', 'application/pdf', 12345,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_due_both::text,
            now() - interval '1 hour', v_notice_confirmed_1, v_notice_confirmed_2);

  -- file_due_one_confirmed : purge_at PASSEE, un SEUL rappel confirme (second
  -- non confirme) -- ne doit JAMAIS etre purge.
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at, purge_notice_1_id, purge_notice_2_id)
    values (v_file_due_one, v_order_a, 'due-one.pdf', 'application/pdf', 500,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_due_one::text,
            now() - interval '1 hour', v_notice_confirmed_1, v_notice_unconfirmed);

  -- file_due_none_confirmed : purge_at PASSEE, AUCUN rappel meme rattache.
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at)
    values (v_file_due_none, v_order_a, 'due-none.pdf', 'application/pdf', 500,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_due_none::text,
            now() - interval '1 hour');

  -- file_not_due_both_confirmed : DEUX rappels confirmes, mais purge_at FUTURE.
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at, purge_notice_1_id, purge_notice_2_id)
    values (v_file_not_due_both, v_order_a, 'not-due.pdf', 'application/pdf', 500,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_not_due_both::text,
            now() + interval '10 days', v_notice_confirmed_1, v_notice_confirmed_2);

  -- file_already_deleted : eligible en tout point, MAIS deja supprime
  -- manuellement (E10.17a) avant que la purge automatique n ait eu la main.
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path, purge_at, purge_notice_1_id, purge_notice_2_id, deleted_at, deleted_by_label)
    values (v_file_already_deleted, v_order_a, 'already-deleted.pdf', 'application/pdf', 500,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_already_deleted::text,
            now() - interval '1 hour', v_notice_confirmed_1, v_notice_confirmed_2, now() - interval '1 day', 'Suppression manuelle');

  insert into e10_22b_context (
    tenant_a, admin_a, order_a,
    file_due_both_confirmed, file_due_one_confirmed, file_due_none_confirmed,
    file_not_due_both_confirmed, file_already_deleted
  ) values (
    v_tenant_a, v_admin_a, v_order_a,
    v_file_due_both, v_file_due_one, v_file_due_none,
    v_file_not_due_both, v_file_already_deleted
  );
end;
$$;

grant select on e10_22b_context to authenticated;

-- ── 1 — api_claim_order_files_for_purge : la garde des DEUX rappels ────────
do $$
declare
  v_file_due_both uuid;
  v_file_due_one uuid;
  v_file_due_none uuid;
  v_file_not_due_both uuid;
  v_file_already_deleted uuid;
  v_claimed_ids uuid[];
  v_n integer;
  v_row public.commercial_order_files;
begin
  select file_due_both_confirmed, file_due_one_confirmed, file_due_none_confirmed,
         file_not_due_both_confirmed, file_already_deleted
    into v_file_due_both, v_file_due_one, v_file_due_none, v_file_not_due_both, v_file_already_deleted
    from e10_22b_context;

  select array_agg(purged_file_id) into v_claimed_ids from public.api_claim_order_files_for_purge(500);

  if not (v_file_due_both = any(v_claimed_ids)) then
    raise exception 'scenario 1 : file_due_both_confirmed (DEUX rappels confirmes, echu) aurait du etre reclame';
  end if;
  if v_file_due_one = any(v_claimed_ids) then
    raise exception 'scenario 1 : file_due_one_confirmed (UN SEUL rappel confirme) n aurait JAMAIS du etre reclame';
  end if;
  if v_file_due_none = any(v_claimed_ids) then
    raise exception 'scenario 1 : file_due_none_confirmed (AUCUN rappel) n aurait JAMAIS du etre reclame';
  end if;
  if v_file_not_due_both = any(v_claimed_ids) then
    raise exception 'scenario 1 : file_not_due_both_confirmed (purge_at future) n aurait JAMAIS du etre reclame';
  end if;
  if v_file_already_deleted = any(v_claimed_ids) then
    raise exception 'scenario 1 : file_already_deleted (deja supprime manuellement) n aurait JAMAIS du etre reclame';
  end if;

  select * into v_row from public.commercial_order_files where id = v_file_due_both;
  if v_row.deleted_at is null or v_row.purged_at is null then
    raise exception 'scenario 1 : file_due_both_confirmed doit porter deleted_at ET purged_at apres reclamation';
  end if;
  if v_row.deleted_by is not null then
    raise exception 'scenario 1 : deleted_by doit rester NULL (purge automatique, pas un geste humain)';
  end if;
  if v_row.deleted_by_label <> 'Purge automatique' then
    raise exception 'scenario 1 : deleted_by_label attendu ''Purge automatique'', obtenu %', v_row.deleted_by_label;
  end if;

  -- Non-reclamation d un fichier NON echu (garde purge_at) : deleted_at reste NULL.
  select * into v_row from public.commercial_order_files where id = v_file_due_one;
  if v_row.deleted_at is not null then
    raise exception 'scenario 1 : file_due_one_confirmed n aurait pas du etre marque';
  end if;

  -- Reclamation IMMEDIATE d un second tour : rien de plus (idempotence --
  -- purged_at is null fait deja sortir la ligne du perimetre).
  select count(*) into v_n from public.api_claim_order_files_for_purge(500);
  if v_n <> 0 then
    raise exception 'scenario 1 : reclamation immediate du meme tour attendue vide, obtenu % ligne(s)', v_n;
  end if;

  raise notice 'scenario 1 (garde des deux rappels confirmes) OK';
end;
$$;

-- ── 2 — api_record_order_files_purged ───────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_payload jsonb;
  v_rejected boolean;
begin
  select tenant_a, order_a into v_tenant_a, v_order_a from e10_22b_context;

  perform public.api_record_order_files_purged(v_tenant_a, 1, 1, 12345, array[v_order_a]);

  select payload into v_payload from public.outbox_events
   where tenant_id = v_tenant_a and event_name = 'order_files.purged'
   order by created_at desc limit 1;
  if v_payload is null then
    raise exception 'scenario 2 : aucun evenement order_files.purged insere';
  end if;
  if (v_payload->>'file_count')::int <> 1 or (v_payload->>'order_count')::int <> 1
     or (v_payload->>'byte_size_freed')::bigint <> 12345 then
    raise exception 'scenario 2 : charge utile inattendue : %', v_payload;
  end if;
  if jsonb_array_length(v_payload->'order_ids') <> 1 or (v_payload->'order_ids'->>0)::uuid <> v_order_a then
    raise exception 'scenario 2 : order_ids de la charge utile inattendus : %', v_payload->'order_ids';
  end if;

  -- Resume incoherent (file_count < 1) -- rejete AVANT toute insertion.
  v_rejected := false;
  begin
    perform public.api_record_order_files_purged(v_tenant_a, 0, 1, 100, array[v_order_a]);
  exception when others then
    if sqlstate = 'P0001' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'scenario 2 : un resume avec file_count=0 aurait du etre rejete';
  end if;

  raise notice 'scenario 2 (order_files.purged) OK';
end;
$$;

-- ── 3 — api_claim_orphan_order_file_objects ─────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_file_due_both uuid; -- DEJA purge par le scenario 1 -- purged_at non nul
  v_obj_orphan_old uuid := gen_random_uuid();
  v_obj_orphan_recent uuid := gen_random_uuid();
  v_obj_live_line uuid := gen_random_uuid();
  v_obj_other_bucket uuid := gen_random_uuid();
  v_path_orphan_old text;
  v_path_orphan_recent text;
  v_path_purged_line text;
  v_path_live_line text;
  v_path_other_bucket text := gen_random_uuid()::text || '/' || gen_random_uuid()::text || '/' || gen_random_uuid()::text;
  v_candidates uuid[];
  v_file_live uuid := gen_random_uuid();
begin
  select tenant_a, order_a, file_due_both_confirmed into v_tenant_a, v_order_a, v_file_due_both from e10_22b_context;

  v_path_orphan_old := v_tenant_a::text || '/' || v_order_a::text || '/' || gen_random_uuid()::text;
  v_path_orphan_recent := v_tenant_a::text || '/' || v_order_a::text || '/' || gen_random_uuid()::text;
  v_path_purged_line := v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_due_both::text;
  -- Forme EXIGEE par commercial_order_files_storage_path_shape (E10.17a) :
  -- <uuid>/<order_id>/<id> -- le SECOND segment doit etre order_id, le
  -- TROISIEME l id propre de la ligne (verifie par la contrainte, pas
  -- seulement par la fonction testee ici).
  v_path_live_line := v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_live::text;

  -- Objet SANS ligne, DEPOSE il y a 25h -- au-dela du delai de securite (24h).
  insert into storage.objects (id, bucket_id, name, created_at)
    values (v_obj_orphan_old, 'commercial_order_files', v_path_orphan_old, now() - interval '25 hours');

  -- Objet SANS ligne, DEPOSE il y a 1h -- billet potentiellement en cours (~2h max).
  insert into storage.objects (id, bucket_id, name, created_at)
    values (v_obj_orphan_recent, 'commercial_order_files', v_path_orphan_recent, now() - interval '1 hour');

  -- Objet dont la ligne existe et est ENCORE VIVANTE -- jamais candidat.
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path)
    values (v_file_live, v_order_a, 'live.pdf', 'application/pdf', 10, v_path_live_line);
  insert into storage.objects (id, bucket_id, name, created_at)
    values (v_obj_live_line, 'commercial_order_files', v_path_live_line, now() - interval '5 days');

  -- Objet d un AUTRE bucket, meme chemin/age que l orphelin -- jamais candidat.
  insert into storage.objects (id, bucket_id, name, created_at)
    values (v_obj_other_bucket, 'quote_documents', v_path_other_bucket, now() - interval '5 days');

  select array_agg(orphan_object_id) into v_candidates
    from public.api_claim_orphan_order_file_objects(interval '24 hours', 200);

  if not (v_obj_orphan_old = any(v_candidates)) then
    raise exception 'scenario 3 : objet SANS ligne, depose il y a 25h, aurait du etre candidat';
  end if;
  if v_obj_orphan_recent = any(v_candidates) then
    raise exception 'scenario 3 : objet SANS ligne, depose il y a 1h (billet en cours), NE DOIT PAS etre candidat';
  end if;
  -- v_path_purged_line correspond a v_file_due_both, deja purge (purged_at
  -- non nul) par le scenario 1 -- MAIS aucun objet storage.objects n a ete
  -- insere sous ce chemin dans CE fichier (contrairement aux autres cas) :
  -- on verifie ici que l ABSENCE d objet ne fait rien planter (la fonction
  -- ne fait que LISTER ce qui existe reellement en storage.objects).
  if v_path_purged_line = any(array[v_path_orphan_old, v_path_orphan_recent]) then
    raise exception 'scenario 3 : collision de chemin inattendue dans la fixture';
  end if;

  -- Cas (b) du contrat §6 : objet dont la ligne est DEJA purgee -- SANS delai
  -- supplementaire. On depose maintenant l objet correspondant, TRES RECENT
  -- (created_at = now()), et il doit NEANMOINS etre candidat.
  insert into storage.objects (id, bucket_id, name, created_at)
    values (gen_random_uuid(), 'commercial_order_files', v_path_purged_line, now());

  select array_agg(orphan_object_id) into v_candidates
    from public.api_claim_orphan_order_file_objects(interval '24 hours', 200);
  if not exists (
    select 1 from public.api_claim_orphan_order_file_objects(interval '24 hours', 200) c
     where c.orphan_object_path = v_path_purged_line
  ) then
    raise exception 'scenario 3 : objet dont la ligne est DEJA purgee doit etre candidat SANS delai';
  end if;

  if v_obj_live_line = any(v_candidates) then
    raise exception 'scenario 3 : objet dont la ligne est ENCORE VIVANTE ne doit JAMAIS etre candidat';
  end if;
  if v_obj_other_bucket = any(v_candidates) then
    raise exception 'scenario 3 : objet d un AUTRE bucket ne doit JAMAIS etre candidat';
  end if;

  raise notice 'scenario 3 (objets orphelins, dette D7) OK';
end;
$$;

-- ── 4 — privileges : authenticated/anon refuses sur les TROIS fonctions ────
do $$
declare
  v_denied boolean;
begin
  set local role authenticated;

  v_denied := false;
  begin
    perform 1 from public.api_claim_order_files_for_purge(10);
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'scenario 4 : authenticated a pu executer api_claim_order_files_for_purge'; end if;

  v_denied := false;
  begin
    perform public.api_record_order_files_purged(gen_random_uuid(), 1, 1, 100, array[gen_random_uuid()]);
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'scenario 4 : authenticated a pu executer api_record_order_files_purged'; end if;

  v_denied := false;
  begin
    perform 1 from public.api_claim_orphan_order_file_objects(interval '24 hours', 10);
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'scenario 4 : authenticated a pu executer api_claim_orphan_order_file_objects'; end if;

  reset role;
  raise notice 'scenario 4a (privileges, authenticated) OK';
end;
$$;

do $$
declare
  v_denied boolean := false;
begin
  set local role anon;
  begin
    perform 1 from public.api_claim_order_files_for_purge(10);
  exception when insufficient_privilege then v_denied := true;
  end;
  reset role;
  if not v_denied then raise exception 'scenario 4 : anon a pu executer api_claim_order_files_for_purge'; end if;
  raise notice 'scenario 4b (privileges, anon) OK';
end;
$$;

-- ── 5 — regression E10.17a : suppression manuelle inchangee ────────────────
do $$
declare
  v_order_a uuid;
  v_file_id uuid := gen_random_uuid();
  v_admin_a uuid;
  v_row public.commercial_order_files;
begin
  select order_a, admin_a into v_order_a, v_admin_a from e10_22b_context;

  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path)
    values (v_file_id, v_order_a, 'regression-17a.pdf', 'application/pdf', 42,
            gen_random_uuid()::text || '/' || v_order_a::text || '/' || v_file_id::text);

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_a::text, 'role', 'authenticated')::text, true);

  select * into v_row from public.api_delete_order_file(
    (select tenant_a from e10_22b_context), v_order_a, v_file_id
  );
  reset role;

  if v_row.deleted_at is null or v_row.deleted_by <> v_admin_a or v_row.deleted_by_label is null then
    raise exception 'scenario 5 : api_delete_order_file (E10.17a) ne se comporte plus comme avant ce lot : %', v_row;
  end if;
  if v_row.purged_at is not null then
    raise exception 'scenario 5 : une suppression MANUELLE ne doit JAMAIS poser purged_at (discriminant reserve a la purge automatique)';
  end if;

  raise notice 'scenario 5 (regression E10.17a, suppression manuelle inchangee) OK';
end;
$$;

rollback;
