-- ============================================================================
-- E10.10b-4a — import et stockage du gabarit PDF par tenant : table
-- `document_pdf_templates`, bucket prive `document_pdf_templates`, quatre
-- fonctions `api_*` (creation, mise a jour, confirmation d import,
-- suppression), RLS (isolation inter-tenant + garde
-- can_manage_document_templates EN BASE, defense en profondeur derriere les
-- fonctions security definer). Migration : 20260909020000. Contrat :
-- docs/api/CONVENTIONS.md §8.18.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : le seed, les
-- quatre fonctions `api_*`, la RLS et le bucket vivent ENTIEREMENT dans la
-- migration 20260909020000 — une lecture de son texte ne prouve pas qu ils se
-- comportent correctement sous appel reel (meme lecon que E10.13).
--
-- Scenarios :
--   1. Bucket `document_pdf_templates` : prive, 10 Mo, application/pdf seul.
--   2. RLS lecture : un membre du tenant B ne voit AUCUN gabarit du tenant A ;
--      un membre SANS can_manage_document_templates voit NEANMOINS les
--      gabarits de SON PROPRE tenant (lecture ouverte a tout membre, contrat).
--   3. RLS ecriture DIRECTE (defense en profondeur, hors fonctions) : un
--      membre SANS can_manage_document_templates ne peut pas modifier une
--      ligne de son propre tenant ; un admin (capability par derivation) le
--      peut.
--   4. api_create_document_pdf_template : refuse sans le droit ; cree
--      awaiting_upload ; nom unique NORMALISE (rejet meme sur un nom aux
--      espaces/casse differents) ; plafond de 20 par tenant ET par type de
--      document.
--   5. api_update_document_pdf_template : refuse sans le droit ; renommage ;
--      is_default=true refuse tant que non ready/actif
--      (default_requires_ready) ; is_default=true accepte sur un gabarit
--      ready+actif et retire le drapeau au PRECEDENT dans la MEME
--      transaction ; is_active=false sur le gabarit par defaut efface aussi
--      is_default (invariant EN BASE : un defaut est ready ET actif).
--   6. api_confirm_document_pdf_template_upload : not_found hors tenant ;
--      passage a `ready` avec la geometrie fournie ; application DIFFEREE de
--      `requested_default` (pose a la creation, applique SEULEMENT ici,
--      retire au gabarit precedent) ; geometry_changed refuse un changement
--      de geometrie sur un gabarit ready dont la carte (`lines_block`) n est
--      pas vide, SAUF reset_fields (qui efface alors `lines_block`).
--   7. api_delete_document_pdf_template : not_found hors tenant ; suppression
--      reussie. Le 409 `in_use` (cle etrangere `quote_documents.template_id
--      on delete restrict`) est INATTEIGNABLE tant qu E10.10b-4c n a pas
--      livre sa migration — non teste ici pour cette raison, pas par oubli.
--   8. qa-review B1 (faille corrigee) : la contrainte CHECK
--      `document_pdf_templates_storage_path_canonical` refuse EN BASE tout
--      `storage_path` qui ne soit pas exactement `<tenant_id>/<id>.pdf` —
--      y compris un chemin POINTANT VERS UN AUTRE TENANT, meme pose en
--      ecriture PRIVILEGIEE (la contrainte ne depend d aucun role). Confirme
--      aussi que `api_confirm_document_pdf_template_upload` n accepte plus
--      de parametre de chemin (la RECALCULE elle-meme) : la seule facon
--      d atteindre un `storage_path` erronne serait de contourner LA
--      FONCTION, ce que cette contrainte ferme.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_10b_4a_context (
  actor_admin  uuid not null,
  actor_member uuid not null,
  actor_b      uuid not null,
  tenant_a     uuid not null,
  tenant_b     uuid not null
);

grant select on e10_10b_4a_context to authenticated;

-- ── 1. Bucket, en phase privilegiee ─────────────────────────────────────────
do $$
declare
  v_public boolean;
  v_limit bigint;
  v_mime text[];
begin
  select public, file_size_limit, allowed_mime_types
    into v_public, v_limit, v_mime
    from storage.buckets where id = 'document_pdf_templates';

  if v_public is null then
    raise exception 'bucket document_pdf_templates absent';
  end if;
  if v_public is true then
    raise exception 'bucket document_pdf_templates PUBLIC (attendu prive)';
  end if;
  if v_limit <> 10485760 then
    raise exception 'file_size_limit inattendu : % (attendu 10485760)', v_limit;
  end if;
  if v_mime <> array['application/pdf']::text[] then
    raise exception 'allowed_mime_types inattendu : %', v_mime;
  end if;
end;
$$;

-- ── Prealables, joues en tant que postgres ─────────────────────────────────
do $$
declare
  v_actor_admin uuid := gen_random_uuid();
  v_actor_member uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_admin, 'e10-10b-4a-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_member, 'e10-10b-4a-member@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-10b-4a-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-10b-4a-tenant-a', 'E10.10b-4a Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-10b-4a-tenant-b', 'E10.10b-4a Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_member, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  -- Un gabarit dans CHAQUE tenant, insere en phase privilegiee (bypass RLS),
  -- pour le scenario de lecture inter-tenant (2).
  insert into public.document_pdf_templates (tenant_id, name) values (v_tenant_a, 'Papier tenant A');
  insert into public.document_pdf_templates (tenant_id, name) values (v_tenant_b, 'Papier tenant B');

  insert into e10_10b_4a_context (actor_admin, actor_member, actor_b, tenant_a, tenant_b)
  values (v_actor_admin, v_actor_member, v_actor_b, v_tenant_a, v_tenant_b);
end;
$$;

-- ── 2. RLS lecture ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_b::text from e10_10b_4a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_visible integer;
begin
  select tenant_a into v_tenant_a from e10_10b_4a_context;
  select count(*) into v_visible from public.document_pdf_templates where tenant_id = v_tenant_a;
  if v_visible <> 0 then
    raise exception 'le tenant B lit % gabarit(s) du tenant A — document_pdf_templates_select rompue', v_visible;
  end if;
end;
$$;

reset role;

-- Lecture OUVERTE a tout membre, MEME SANS can_manage_document_templates
-- (contrat : "Ne conditionne PAS la LECTURE des gabarits").
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_member::text from e10_10b_4a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_visible integer;
begin
  select tenant_a into v_tenant_a from e10_10b_4a_context;
  select count(*) into v_visible from public.document_pdf_templates where tenant_id = v_tenant_a;
  if v_visible <> 1 then
    raise exception 'un membre SANS can_manage_document_templates ne lit pas son propre tenant (attendu 1, lu %)', v_visible;
  end if;
end;
$$;

reset role;

-- ── 3. RLS ecriture DIRECTE (defense en profondeur, hors fonctions) ────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_member::text from e10_10b_4a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_updated integer;
begin
  select tenant_a into v_tenant_a from e10_10b_4a_context;
  update public.document_pdf_templates set name = 'Renomme sans droit' where tenant_id = v_tenant_a;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'un membre SANS can_manage_document_templates a pu modifier un gabarit en DIRECT (document_pdf_templates_write rompue)';
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_10b_4a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_updated integer;
begin
  select tenant_a into v_tenant_a from e10_10b_4a_context;
  update public.document_pdf_templates set name = 'Renomme par admin (direct)' where tenant_id = v_tenant_a;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'un admin (derivation) n a pas pu modifier un gabarit en DIRECT (attendu 1 ligne, % modifiee(s))', v_updated;
  end if;
end;
$$;

reset role;

-- ── 4. api_create_document_pdf_template ─────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_member uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_member into v_tenant_a, v_actor_member from e10_10b_4a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Refuse sans droit', false);
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un membre SANS can_manage_document_templates a pu creer un gabarit (attendu permission_denied)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_created public.document_pdf_templates;
  v_normalized_conflict boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_created := public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Papier a en-tete 2026', false);
  reset role;

  if v_created.status <> 'awaiting_upload' then
    raise exception 'un gabarit cree n est pas awaiting_upload : %', v_created.status;
  end if;
  if v_created.is_default is not false then
    raise exception 'un gabarit cree porte is_default a la creation (attendu false, applique a la confirmation)';
  end if;

  begin
    insert into public.document_pdf_templates (tenant_id, name) values (v_tenant_a, '  papier a en-tete 2026  ');
  exception
    when unique_violation then v_normalized_conflict := true;
  end;
  if not v_normalized_conflict then
    raise exception 'un nom "  papier a en-tete 2026  " a ete accepte alors qu il existe deja normalise';
  end if;
end;
$$;

-- Plafond de 20 gabarits PAR TENANT ET PAR TYPE (document_pdf_template.limit_reached).
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_i integer;
  v_existing integer;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4a_context;

  select count(*) into v_existing from public.document_pdf_templates where tenant_id = v_tenant_a and document_type = 'quote';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  for v_i in 1..(20 - v_existing) loop
    perform public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Gabarit genere ' || v_i::text, false);
  end loop;

  begin
    perform public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Gabarit en trop', false);
  exception
    when others then
      if sqlerrm like 'document_pdf_template.limit_reached%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un 21e gabarit a ete cree pour ce tenant/type (attendu document_pdf_template.limit_reached)';
  end if;
end;
$$;

-- Nettoyage des gabarits generes pour ce scenario (garde les suivants lisibles).
delete from public.document_pdf_templates
 where tenant_id = (select tenant_a from e10_10b_4a_context)
   and name like 'Gabarit genere %';

-- ── 5. api_update_document_pdf_template ─────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_member uuid;
  v_template_id uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_member into v_tenant_a, v_actor_member from e10_10b_4a_context;
  select id into v_template_id from public.document_pdf_templates
   where tenant_id = v_tenant_a and name = 'Papier a en-tete 2026';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_update_document_pdf_template(v_tenant_a, v_template_id, true, 'Renomme sans droit', false, null, false, null);
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un membre SANS can_manage_document_templates a pu modifier via la fonction (attendu permission_denied)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_template_id uuid;
  v_updated public.document_pdf_templates;
  v_default_rejected boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4a_context;
  select id into v_template_id from public.document_pdf_templates
   where tenant_id = v_tenant_a and name = 'Papier a en-tete 2026';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_updated := public.api_update_document_pdf_template(v_tenant_a, v_template_id, true, 'Papier a en-tete 2026 (renomme)', false, null, false, null);
  if v_updated.name <> 'Papier a en-tete 2026 (renomme)' then
    raise exception 'renommage non applique : %', v_updated.name;
  end if;

  -- is_default=true refuse : le gabarit est encore awaiting_upload.
  begin
    perform public.api_update_document_pdf_template(v_tenant_a, v_template_id, false, null, true, true, false, null);
  exception
    when others then
      if sqlerrm like 'document_pdf_template.default_requires_ready%' then v_default_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_default_rejected then
    raise exception 'is_default=true accepte sur un gabarit awaiting_upload (attendu default_requires_ready)';
  end if;
end;
$$;

-- ── 6. api_confirm_document_pdf_template_upload ─────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_not_found boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_confirm_document_pdf_template_upload(
      v_tenant_a, gen_random_uuid(), 1, '[]'::jsonb, 1000, repeat('a', 64), false
    );
  exception
    when others then
      if sqlerrm like 'document_pdf_template.not_found%' then v_not_found := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_not_found then
    raise exception 'confirmation sur un gabarit inexistant acceptee (attendu document_pdf_template.not_found)';
  end if;
end;
$$;

-- Deux gabarits READY, is_default applique EN DIFFERE + bascule transactionnelle.
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_first_id uuid;
  v_second_id uuid;
  v_first_confirmed public.document_pdf_templates;
  v_second_confirmed public.document_pdf_templates;
  v_first_after public.document_pdf_templates;
  v_pages jsonb := '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_first_id := (public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Gabarit defaut 1', true)).id;
  v_first_confirmed := public.api_confirm_document_pdf_template_upload(
    v_tenant_a, v_first_id, 1, v_pages, 12345, repeat('a', 64), false
  );

  if v_first_confirmed.status <> 'ready' then
    raise exception 'confirmation n a pas fait passer le gabarit a ready : %', v_first_confirmed.status;
  end if;
  if v_first_confirmed.is_default is not true then
    raise exception 'requested_default n a pas ete applique a la confirmation (attendu is_default=true)';
  end if;

  v_second_id := (public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Gabarit defaut 2', true)).id;
  v_second_confirmed := public.api_confirm_document_pdf_template_upload(
    v_tenant_a, v_second_id, 1, v_pages, 12345, repeat('b', 64), false
  );
  reset role;

  if v_second_confirmed.is_default is not true then
    raise exception 'le second gabarit confirme avec requested_default n est pas devenu le defaut';
  end if;

  select * into v_first_after from public.document_pdf_templates where id = v_first_id;
  if v_first_after.is_default is not false then
    raise exception 'le premier gabarit est reste par defaut apres la confirmation du second (bascule non transactionnelle)';
  end if;
end;
$$;

-- geometry_changed : carte (lines_block) non vide, geometrie modifiee, refuse
-- SAUF reset_fields.
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_template_id uuid;
  v_rejected boolean := false;
  v_confirmed public.document_pdf_templates;
  v_pages_a4 jsonb := '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb;
  v_pages_letter jsonb := '[{"index":0,"width_pt":612,"height_pt":792}]'::jsonb;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_template_id := (public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Gabarit geometrie', false)).id;
  perform public.api_confirm_document_pdf_template_upload(
    v_tenant_a, v_template_id, 1, v_pages_a4, 1000, repeat('c', 64), false
  );

  -- Simule une carte non vide (E10.10b-4b n a pas encore livre sa table :
  -- `lines_block` est deja une colonne de CE lot, seule 4b sait normalement
  -- l ecrire — on la pose ici directement pour exercer has_field_map).
  update public.document_pdf_templates
     set lines_block = '{"anchor_x":10,"anchor_y":10,"row_height":12,"rows_per_page":20,"columns":[]}'::jsonb
   where id = v_template_id;

  begin
    perform public.api_confirm_document_pdf_template_upload(
      v_tenant_a, v_template_id, 1, v_pages_letter, 1000, repeat('d', 64), false
    );
  exception
    when others then
      if sqlerrm like 'document_pdf_template.geometry_changed%' then v_rejected := true; else reset role; raise; end if;
  end;

  if not v_rejected then
    reset role;
    raise exception 'un changement de geometrie sur un gabarit ready avec carte non vide a ete accepte sans reset_fields';
  end if;

  v_confirmed := public.api_confirm_document_pdf_template_upload(
    v_tenant_a, v_template_id, 1, v_pages_letter, 1000, repeat('e', 64), true
  );
  reset role;

  if v_confirmed.pages <> v_pages_letter then
    raise exception 'la nouvelle geometrie n a pas ete enregistree malgre reset_fields';
  end if;
  if exists (select 1 from public.document_pdf_templates where id = v_template_id and lines_block is not null) then
    raise exception 'lines_block n a pas ete efface par reset_fields';
  end if;
end;
$$;

-- ── 5bis. is_active=false sur le gabarit PAR DEFAUT efface aussi is_default ─
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_default_id uuid;
  v_updated public.document_pdf_templates;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4a_context;
  select id into v_default_id from public.document_pdf_templates
   where tenant_id = v_tenant_a and name = 'Gabarit defaut 2';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_updated := public.api_update_document_pdf_template(v_tenant_a, v_default_id, false, null, false, null, true, false);
  reset role;

  if v_updated.is_active is not false then
    raise exception 'is_active=false non applique';
  end if;
  if v_updated.is_default is not false then
    raise exception 'is_default n a pas ete efface par la desactivation du gabarit par defaut (invariant EN BASE)';
  end if;
end;
$$;

-- ── 7. api_delete_document_pdf_template ─────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_not_found boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_delete_document_pdf_template(v_tenant_a, gen_random_uuid());
  exception
    when others then
      if sqlerrm like 'document_pdf_template.not_found%' then v_not_found := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_not_found then
    raise exception 'suppression d un gabarit inexistant acceptee (attendu document_pdf_template.not_found)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_template_id uuid;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4a_context;
  select id into v_template_id from public.document_pdf_templates
   where tenant_id = v_tenant_a and name = 'Gabarit geometrie';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.api_delete_document_pdf_template(v_tenant_a, v_template_id);
  reset role;

  if exists (select 1 from public.document_pdf_templates where id = v_template_id) then
    raise exception 'le gabarit existe encore apres suppression';
  end if;
end;
$$;

-- ── 8. qa-review B1 — chemin forge REFUSE EN BASE (CHECK), y compris en
--      ecriture PRIVILEGIEE (la contrainte ne depend d aucun role) ─────────
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_actor_admin uuid;
  v_template_id uuid;
  v_confirmed public.document_pdf_templates;
  v_pages jsonb := '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb;
  v_rejected boolean := false;
begin
  select tenant_a, tenant_b, actor_admin into v_tenant_a, v_tenant_b, v_actor_admin from e10_10b_4a_context;

  v_template_id := (public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Gabarit B1', false)).id;

  -- 8a. Ecriture DIRECTE, en phase PRIVILEGIEE (bypass RLS) : un chemin
  -- pointant vers UN AUTRE TENANT est refuse par la contrainte CHECK, pas
  -- seulement par la RLS (qui ne s applique meme pas ici).
  begin
    update public.document_pdf_templates
       set storage_path = v_tenant_b::text || '/' || gen_random_uuid()::text || '.pdf'
     where id = v_template_id;
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'un storage_path pointant vers un AUTRE TENANT a ete accepte en base (contrainte CHECK contournee)';
  end if;

  -- 8b. Meme refus sur un chemin qui ne respecte pas le FORMAT canonique,
  -- meme a l interieur du BON tenant (traversee de repertoire, extension,
  -- ou UUID different de l id de la ligne).
  v_rejected := false;
  begin
    update public.document_pdf_templates
       set storage_path = v_tenant_a::text || '/../../etc/passwd'
     where id = v_template_id;
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'un storage_path hors format canonique a ete accepte en base (contrainte CHECK contournee)';
  end if;

  -- 8c. `api_confirm_document_pdf_template_upload` ne recoit PLUS de
  -- parametre de chemin : le chemin PERSISTE est toujours exactement
  -- `<tenant_id>/<id>.pdf`, jamais autre chose, quel que soit ce que la
  -- facade appelante croirait pouvoir influencer.
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_confirmed := public.api_confirm_document_pdf_template_upload(
    v_tenant_a, v_template_id, 1, v_pages, 1000, repeat('f', 64), false
  );
  reset role;

  if v_confirmed.status <> 'ready' then
    raise exception 'confirmation (scenario B1) n a pas fait passer le gabarit a ready';
  end if;

  perform 1 from public.document_pdf_templates
   where id = v_template_id
     and storage_path = v_tenant_a::text || '/' || v_template_id::text || '.pdf';
  if not found then
    raise exception 'storage_path persiste n est PAS le chemin canonique attendu apres confirmation';
  end if;
end;
$$;

rollback;
