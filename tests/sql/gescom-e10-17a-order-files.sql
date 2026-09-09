-- ============================================================================
-- E10.17a — fichiers d une commande (depot, visibilite, suppression) : table
-- `commercial_order_files`, bucket prive `commercial_order_files`, trois
-- fonctions `api_*` (confirmation, visibilite, suppression), RLS (isolation
-- inter-tenant, AUCUNE garde de capability, ecriture PostgREST DIRECTE
-- bloquee pour tout role), defense en profondeur sur la cle etrangere
-- composite (ligne d une autre commande) et sur la forme du chemin de
-- stockage (qa-review B1, E10.10b-4a). Migration : `20260909060000`.
-- Contrat : docs/api/CONVENTIONS.md §8.19.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : la table, le
-- bucket, la RLS et les trois fonctions vivent ENTIEREMENT dans la migration
-- `20260909060000` — une lecture de son texte ne prouve pas qu ils se
-- comportent correctement sous appel reel (meme lecon que E10.10b-4a/E10.14).
--
-- Scenarios :
--   1. Bucket `commercial_order_files` : prive, 50 Mo, sept types MIME
--      (cinq usuels + deux pour l archive ZIP).
--   2. Fixtures : tenant A (admin, member), tenant B (actor_b) ; deux
--      commandes du tenant A (order_a, order_b), chacune avec sa propre ligne
--      (order_line_a, order_line_b) — pour le scenario de ligne d une AUTRE
--      commande (decision #11).
--   3. RLS lecture : le tenant B ne voit AUCUN fichier d une commande du
--      tenant A ; un membre SANS aucune capability particuliere voit
--      NEANMOINS les fichiers de SON PROPRE tenant (decision #4, aucune
--      garde de capability).
--   4. RLS ecriture DIRECTE : AUCUN role applicatif (ni membre, ni admin) ne
--      peut INSERT/UPDATE/DELETE directement sur `commercial_order_files` —
--      la seule voie est les trois fonctions `security definer`
--      (`revoke insert, update, delete ... from authenticated, anon`, motif
--      qui N EST PAS l append-only : cette table EST mutable).
--   5. `api_confirm_order_file_upload` : permission_denied pour un acteur
--      ETRANGER au tenant ; `order.not_found` pour une commande hors tenant
--      (code REUTILISE) ; creation reussie avec chemin CANONIQUE
--      `<tenant_id>/<order_id>/<file_id>` ; visibilite absente -> `internal`
--      par defaut ; `order_file.line_not_found` pour une ligne d une AUTRE
--      commande (order_line_b cite sur order_a) ; `order_file.already_
--      confirmed` sur un `file_id` deja porteur d une ligne ; plafond de 30
--      fichiers VIVANTS SOUS VERROU (`order_file.limit_reached`), un fichier
--      supprime ne compte plus.
--   5bis. qa-review B1 round 2 (BLOQUANT, corrige) : les fonctions
--      `api_confirm_order_file_upload`/`api_delete_order_file` ne portent
--      PLUS de parametre `p_actor_label` — un appel a neuf/quatre arguments
--      (tentative d ecraser le libelle AUTHENTIFIE, faille prouvee par
--      exploitation reelle en qa-review) echoue en `undefined_function`
--      AVANT meme d atteindre le corps de la fonction ; le libelle enregistre
--      reste TOUJOURS l e-mail de l acteur authentifie.
--   6. `api_update_order_file_visibility` : `order_file.not_found` hors
--      tenant/commande et sur une ligne DEJA SUPPRIMEE ; bascule reussie.
--   7. `api_delete_order_file` : `order_file.not_found` sur un fichier
--      inconnu ; suppression reussie — `deleted_at`/`deleted_by`/
--      `deleted_by_label` poses, LIGNE CONSERVEE (visible en lecture
--      privilegiee), `storage_path` REND a l identique de celui persiste ;
--      la ligne supprimee n apparait plus dans aucune lecture RLS normale.
--   8. qa-review B1 (meme lecon qu E10.10b-4a) : la contrainte CHECK
--      `commercial_order_files_storage_path_shape` refuse EN BASE tout
--      `storage_path` hors du format canonique SUR LES SEGMENTS QU ELLE PEUT
--      VERIFIER (order_id/id, colonnes de la ligne), MEME EN ECRITURE
--      PRIVILEGIEE ; LIMITE DOCUMENTEE ET PROUVEE (8a-bis) : un chemin bien
--      forme mais portant un tenant DIFFERENT (segment non verifiable en
--      VALEUR, table sans colonne `tenant_id`) est ACCEPTE par cette
--      contrainte — la protection reelle reste la fonction `security
--      definer`, qui ne recoit jamais de chemin en parametre.
--   9. Decision #11 (structurel) : une insertion DIRECTE (privilegiee,
--      bypass RLS ET bypass la fonction) citant `order_line_id` d une AUTRE
--      commande que `order_id` est refusee par la cle etrangere COMPOSITE
--      `commercial_order_files_line_fk` — impossible independamment de tout
--      controle applicatif. qa-review N1 (corrige) : le `storage_path` de ce
--      scenario est de FORME CANONIQUE pour ne prouver QUE la FK, jamais la
--      contrainte de forme (seule `foreign_key_violation` est acceptee).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_17a_context (
  actor_admin    uuid not null,
  actor_member   uuid not null,
  actor_b        uuid not null,
  actor_stranger uuid not null,
  tenant_a       uuid not null,
  tenant_b       uuid not null,
  customer_a     uuid not null,
  order_a        uuid not null,
  order_b        uuid not null,
  order_line_a   uuid not null,
  order_line_b   uuid not null
);

grant select on e10_17a_context to authenticated;

-- ── 1. Bucket, en phase privilegiee ─────────────────────────────────────────
do $$
declare
  v_public boolean;
  v_limit bigint;
  v_mime text[];
begin
  select public, file_size_limit, allowed_mime_types
    into v_public, v_limit, v_mime
    from storage.buckets where id = 'commercial_order_files';

  if v_public is null then
    raise exception 'bucket commercial_order_files absent';
  end if;
  if v_public is true then
    raise exception 'bucket commercial_order_files PUBLIC (attendu prive)';
  end if;
  if v_limit <> 52428800 then
    raise exception 'file_size_limit inattendu : % (attendu 52428800, 50 Mo)', v_limit;
  end if;
  if v_mime <> array['application/pdf','image/jpeg','image/png','image/webp','image/tiff','application/zip','application/x-zip-compressed']::text[] then
    raise exception 'allowed_mime_types inattendu : %', v_mime;
  end if;
end;
$$;

-- ── 2. Fixtures, jouees en tant que postgres ────────────────────────────────
do $$
declare
  v_actor_admin uuid := gen_random_uuid();
  v_actor_member uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_actor_stranger uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_project uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_quote_a uuid;
  v_quote_b uuid;
  v_quote_line_a uuid;
  v_quote_line_b uuid;
  v_order_a uuid;
  v_order_b uuid;
  v_order_line_a uuid;
  v_order_line_b uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_admin, 'e10-17a-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_member, 'e10-17a-member@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-17a-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_stranger, 'e10-17a-stranger@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-17a-tenant-a', 'E10.17a Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-17a-tenant-b', 'E10.17a Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_member, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.17a Client A', '73282932000074') returning id into v_customer_a;

  insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant_a, v_customer_a, 'Projet E10.17a') returning id into v_project;

  -- DEUX commandes du tenant A, chacune avec sa PROPRE ligne — pour le
  -- scenario de ligne d une AUTRE commande (decision #11, §7 du contrat).
  insert into public.project_items (project_id, label, position) values (v_project, 'Item A', 0) returning id into v_item_a;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-99101', 'draft', '2099-01-01', true)
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
  values (v_tenant_a, v_customer_a, v_quote_a, 'CDE-2026-99101', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12)
  returning id into v_order_a;
  insert into public.commercial_order_lines (
    order_id, source_quote_line_id, origin, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate,
    sale_price, breakdown
  ) values (
    v_order_a, v_quote_line_a, 'project_item', 'Ligne A', 10, 0,
    5, 5, 5, 0, 5, '[{"label":"production"}]'::jsonb
  ) returning id into v_order_line_a;

  insert into public.project_items (project_id, label, position) values (v_project, 'Item B', 1) returning id into v_item_b;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-99102', 'draft', '2099-01-01', true)
    returning id into v_quote_b;
  insert into public.commercial_quote_lines (
    quote_id, project_item_id, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
  ) values (v_quote_b, v_item_b, 'Ligne B', 5, 0, 3, 3, 3, 0, 3, '[{"label":"production"}]'::jsonb) returning id into v_quote_line_b;
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax
  )
  values (v_tenant_a, v_customer_a, v_quote_b, 'CDE-2026-99102', 'validated', 'sent',
          15, 0, null, 15, 0.2, null, 3, 18)
  returning id into v_order_b;
  insert into public.commercial_order_lines (
    order_id, source_quote_line_id, origin, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate,
    sale_price, breakdown
  ) values (
    v_order_b, v_quote_line_b, 'project_item', 'Ligne B', 5, 0,
    3, 3, 3, 0, 3, '[{"label":"production"}]'::jsonb
  ) returning id into v_order_line_b;

  insert into e10_17a_context (
    actor_admin, actor_member, actor_b, actor_stranger, tenant_a, tenant_b, customer_a,
    order_a, order_b, order_line_a, order_line_b
  ) values (
    v_actor_admin, v_actor_member, v_actor_b, v_actor_stranger, v_tenant_a, v_tenant_b, v_customer_a,
    v_order_a, v_order_b, v_order_line_a, v_order_line_b
  );
end;
$$;

-- Un fichier de reference, insere DIRECTEMENT en phase privilegiee (bypass
-- RLS), pour les scenarios de lecture (3) AVANT d exercer les fonctions.
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_file_id uuid := gen_random_uuid();
begin
  select tenant_a, order_a into v_tenant_a, v_order_a from e10_17a_context;
  insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path)
    values (v_file_id, v_order_a, 'reference.pdf', 'application/pdf', 100,
            v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text);
end;
$$;

-- ── 3. RLS lecture ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_b::text from e10_17a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_order_a uuid;
  v_visible integer;
begin
  select order_a into v_order_a from e10_17a_context;
  select count(*) into v_visible from public.commercial_order_files where order_id = v_order_a;
  if v_visible <> 0 then
    raise exception 'le tenant B lit % fichier(s) de commande du tenant A — commercial_order_files_select rompue', v_visible;
  end if;
end;
$$;

reset role;

-- Lecture OUVERTE a tout membre, MEME SANS aucune capability particuliere
-- (decision #4, §8.19 : aucune garde de capability sur ce module).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_member::text from e10_17a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_order_a uuid;
  v_visible integer;
begin
  select order_a into v_order_a from e10_17a_context;
  select count(*) into v_visible from public.commercial_order_files where order_id = v_order_a;
  if v_visible <> 1 then
    raise exception 'un membre du tenant proprietaire ne lit pas le fichier de reference (attendu 1, lu %)', v_visible;
  end if;
end;
$$;

reset role;

-- ── 4. RLS ecriture DIRECTE — AUCUN role applicatif ne peut ecrire ─────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_member::text from e10_17a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_order_a uuid;
  v_rejected boolean := false;
begin
  select order_a into v_order_a from e10_17a_context;
  begin
    insert into public.commercial_order_files (order_id, filename, content_type, byte_size, storage_path)
      values (v_order_a, 'insertion-directe.pdf', 'application/pdf', 10, 'chemin-quelconque');
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'un membre ORDINAIRE a pu INSERT directement (commercial_order_files n est PAS ecrivable en PostgREST direct)';
  end if;
end;
$$;

reset role;

-- MEME refus pour un ADMIN du tenant proprietaire : la table n a AUCUNE
-- policy d ecriture, et le GRANT lui-meme est revoque — contrairement a
-- `document_pdf_templates`, l admin ne peut PAS ecrire directement ici, la
-- seule voie est les trois fonctions `security definer`.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_17a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_order_a uuid;
  v_rejected boolean := false;
begin
  select order_a into v_order_a from e10_17a_context;
  begin
    update public.commercial_order_files set visibility = 'customer' where order_id = v_order_a;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'un ADMIN a pu UPDATE directement (attendu insufficient_privilege, revoke sans exception de role)';
  end if;

  -- qa-review N2 : le resultat du DELETE direct doit etre EXPLICITEMENT
  -- assertionne, comme pour l INSERT et l UPDATE ci-dessus — sans ce
  -- `raise`, si `revoke delete` disparaissait un jour, ce scenario resterait
  -- VERT (aucune assertion ne l aurait jamais fait echouer).
  v_rejected := false;
  begin
    delete from public.commercial_order_files where order_id = v_order_a;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'un ADMIN a pu DELETE directement (attendu insufficient_privilege, revoke sans exception de role)';
  end if;
end;
$$;

reset role;

-- ── 5. api_confirm_order_file_upload ────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_stranger uuid;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, actor_stranger into v_tenant_a, v_order_a, v_actor_stranger from e10_17a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_stranger::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_confirm_order_file_upload(
      v_tenant_a, v_order_a, gen_random_uuid(), 'bat.pdf', null, null, 'application/pdf', 1000
    );
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un acteur ETRANGER au tenant a pu confirmer un depot (attendu permission_denied)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_17a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_confirm_order_file_upload(
      v_tenant_a, gen_random_uuid(), gen_random_uuid(), 'bat.pdf', null, null, 'application/pdf', 1000
    );
  exception
    when others then
      if sqlerrm like 'order.not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'une commande inexistante a ete acceptee (attendu order.not_found, code REUTILISE)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_order_line_a uuid;
  v_file_id uuid := gen_random_uuid();
  v_row public.commercial_order_files;
begin
  select tenant_a, actor_admin, order_a, order_line_a into v_tenant_a, v_actor_admin, v_order_a, v_order_line_a from e10_17a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_row := public.api_confirm_order_file_upload(
    v_tenant_a, v_order_a, v_file_id, 'bat-ligne-a.pdf', v_order_line_a, null, 'application/pdf', 54321
  );
  reset role;

  if v_row.visibility <> 'internal' then
    raise exception 'visibilite absente non defaultee a internal : %', v_row.visibility;
  end if;
  if v_row.order_line_id is distinct from v_order_line_a then
    raise exception 'order_line_id non repris : %', v_row.order_line_id;
  end if;
  if v_row.storage_path <> (v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text) then
    raise exception 'storage_path non canonique : % (attendu %)', v_row.storage_path, (v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text);
  end if;
  if v_row.deposited_by is distinct from v_actor_admin then
    raise exception 'deposited_by inattendu : % (attendu %)', v_row.deposited_by, v_actor_admin;
  end if;
  if v_row.deposited_by_label is distinct from 'e10-17a-admin@example.test' then
    raise exception 'deposited_by_label inattendu : %', v_row.deposited_by_label;
  end if;
end;
$$;

-- qa-review B1 round 2 (BLOQUANT, corrige) : AUCUN parametre ne peut plus
-- ecraser le libelle AUTHENTIFIE de l auteur. La signature ne porte meme
-- plus de neuvieme parametre : un appel qui en fournirait un (comme le
-- ferait un membre ordinaire visant `POST /rest/v1/rpc/api_confirm_order_
-- file_upload` directement avec `p_actor_label: 'patron@usurpe.test'`, la
-- faille prouvee par exploitation reelle en qa-review) echoue AVANT meme
-- d atteindre le corps de la fonction, avec `undefined_function` — pas
-- silencieusement ignore.
do $$
declare
  v_tenant_a uuid;
  v_actor_member uuid;
  v_order_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_member, order_a into v_tenant_a, v_actor_member, v_order_a from e10_17a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_confirm_order_file_upload(
      v_tenant_a, v_order_a, gen_random_uuid(), 'usurpation.pdf', null, null, 'application/pdf', 1000,
      'patron@usurpe.test'
    );
  exception
    when undefined_function then v_rejected := true;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un appel a NEUF arguments (p_actor_label force) a ete accepte — la signature porte encore ce parametre (qa-review B1 round 2 non corrige)';
  end if;
end;
$$;

-- Meme preuve, cote suppression : le libelle enregistre par api_delete_order_file
-- est TOUJOURS l e-mail authentifie, jamais un parametre d appelant — la
-- signature ne porte plus que trois arguments.
do $$
declare
  v_tenant_a uuid;
  v_actor_member uuid;
  v_order_a uuid;
  v_file_id uuid := gen_random_uuid();
  v_deleted public.commercial_order_files;
  v_rejected boolean := false;
begin
  select tenant_a, actor_member, order_a into v_tenant_a, v_actor_member, v_order_a from e10_17a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_deleted := public.api_confirm_order_file_upload(
    v_tenant_a, v_order_a, v_file_id, 'a-supprimer.pdf', null, null, 'application/pdf', 1000
  );

  begin
    perform public.api_delete_order_file(v_tenant_a, v_order_a, v_file_id, 'patron@usurpe.test');
  exception
    when undefined_function then v_rejected := true;
  end;
  if not v_rejected then
    reset role;
    raise exception 'un appel a QUATRE arguments (p_actor_label force) a api_delete_order_file a ete accepte (qa-review B1 round 2 non corrige)';
  end if;

  v_deleted := public.api_delete_order_file(v_tenant_a, v_order_a, v_file_id);
  reset role;

  if v_deleted.deleted_by_label is distinct from 'e10-17a-member@example.test' then
    raise exception 'deleted_by_label inattendu : % (attendu l e-mail AUTHENTIFIE de l acteur, jamais un parametre)', v_deleted.deleted_by_label;
  end if;
end;
$$;

-- Ligne d une AUTRE commande refusee (decision #11) — order_line_b cite sur order_a.
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_order_line_b uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin, order_a, order_line_b into v_tenant_a, v_actor_admin, v_order_a, v_order_line_b from e10_17a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_confirm_order_file_upload(
      v_tenant_a, v_order_a, gen_random_uuid(), 'bat-ligne-b.pdf', v_order_line_b, null, 'application/pdf', 1000
    );
  exception
    when others then
      if sqlerrm like 'order_file.line_not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'une ligne d une AUTRE commande a ete acceptee (attendu order_file.line_not_found, decision #11)';
  end if;
end;
$$;

-- already_confirmed : un file_id deja porteur d une ligne.
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_file_id uuid := gen_random_uuid();
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin, order_a into v_tenant_a, v_actor_admin, v_order_a from e10_17a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.api_confirm_order_file_upload(v_tenant_a, v_order_a, v_file_id, 'premiere-fois.pdf', null, null, 'application/pdf', 1000);

  begin
    perform public.api_confirm_order_file_upload(v_tenant_a, v_order_a, v_file_id, 'deuxieme-fois.pdf', null, null, 'application/pdf', 2000);
  exception
    when others then
      if sqlerrm like 'order_file.already_confirmed%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un file_id deja confirme a ete confirme une SECONDE fois (attendu order_file.already_confirmed)';
  end if;
end;
$$;

-- Plafond de 30 fichiers VIVANTS, SOUS VERROU — un fichier supprime ne compte plus.
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_b uuid;
  v_existing integer;
  v_i integer;
  v_last_file_id uuid;
  v_rejected boolean := false;
begin
  -- Utilise order_b, ENCORE VIERGE de tout fichier (order_a en porte deja
  -- plusieurs des scenarios precedents) : plafond compte par COMMANDE.
  select tenant_a, actor_admin, order_b into v_tenant_a, v_actor_admin, v_order_b from e10_17a_context;
  select count(*) into v_existing from public.commercial_order_files where order_id = v_order_b and deleted_at is null;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  for v_i in 1..(30 - v_existing) loop
    v_last_file_id := gen_random_uuid();
    perform public.api_confirm_order_file_upload(v_tenant_a, v_order_b, v_last_file_id, 'plafond-' || v_i::text || '.pdf', null, null, 'application/pdf', 100);
  end loop;

  begin
    perform public.api_confirm_order_file_upload(v_tenant_a, v_order_b, gen_random_uuid(), 'en-trop.pdf', null, null, 'application/pdf', 100);
  exception
    when others then
      if sqlerrm like 'order_file.limit_reached%' then v_rejected := true; else reset role; raise; end if;
  end;

  if not v_rejected then
    reset role;
    raise exception 'un 31e fichier vivant a ete confirme (attendu order_file.limit_reached)';
  end if;

  -- Un fichier supprime ne compte plus : liberer une place permet le depot suivant.
  perform public.api_delete_order_file(v_tenant_a, v_order_b, v_last_file_id);
  perform public.api_confirm_order_file_upload(v_tenant_a, v_order_b, gen_random_uuid(), 'apres-suppression.pdf', null, null, 'application/pdf', 100);
  reset role;
end;
$$;

-- ── 6. api_update_order_file_visibility ─────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_file_id uuid;
  v_updated public.commercial_order_files;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin, order_a into v_tenant_a, v_actor_admin, v_order_a from e10_17a_context;
  select id into v_file_id from public.commercial_order_files where order_id = v_order_a and filename = 'bat-ligne-a.pdf';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    perform public.api_update_order_file_visibility(v_tenant_a, v_order_a, gen_random_uuid(), 'customer');
  exception
    when others then
      if sqlerrm like 'order_file.not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  if not v_rejected then
    reset role;
    raise exception 'un fichier inexistant a ete visibilise (attendu order_file.not_found)';
  end if;

  v_updated := public.api_update_order_file_visibility(v_tenant_a, v_order_a, v_file_id, 'customer');
  reset role;

  if v_updated.visibility <> 'customer' then
    raise exception 'visibilite non mise a jour : %', v_updated.visibility;
  end if;
end;
$$;

-- ── 7. api_delete_order_file ────────────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_file_id uuid;
  v_expected_path text;
  v_deleted public.commercial_order_files;
  v_rejected boolean := false;
  v_still_visible integer;
begin
  select tenant_a, actor_admin, order_a into v_tenant_a, v_actor_admin, v_order_a from e10_17a_context;
  select id into v_file_id from public.commercial_order_files where order_id = v_order_a and filename = 'bat-ligne-a.pdf';
  v_expected_path := v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    perform public.api_delete_order_file(v_tenant_a, v_order_a, gen_random_uuid());
  exception
    when others then
      if sqlerrm like 'order_file.not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  if not v_rejected then
    reset role;
    raise exception 'un fichier inexistant a ete supprime (attendu order_file.not_found)';
  end if;

  v_deleted := public.api_delete_order_file(v_tenant_a, v_order_a, v_file_id);

  if v_deleted.storage_path <> v_expected_path then
    raise exception 'storage_path rendu par la suppression inattendu : % (attendu %)', v_deleted.storage_path, v_expected_path;
  end if;
  if v_deleted.deleted_at is null then
    raise exception 'deleted_at non pose par api_delete_order_file';
  end if;
  if v_deleted.deleted_by is distinct from v_actor_admin then
    raise exception 'deleted_by inattendu : % (attendu %)', v_deleted.deleted_by, v_actor_admin;
  end if;
  if v_deleted.deleted_by_label is distinct from 'e10-17a-admin@example.test' then
    raise exception 'deleted_by_label inattendu : %', v_deleted.deleted_by_label;
  end if;

  -- Suppression sur une ligne DEJA supprimee -> not_found (irreversible,
  -- rejouer la meme suppression ne "reussit" pas une seconde fois).
  v_rejected := false;
  begin
    perform public.api_delete_order_file(v_tenant_a, v_order_a, v_file_id);
  exception
    when others then
      if sqlerrm like 'order_file.not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  if not v_rejected then
    reset role;
    raise exception 'une suppression rejouee sur une ligne DEJA supprimee a reussi (attendu order_file.not_found)';
  end if;

  -- Visibiliser une ligne DEJA supprimee est refuse au meme titre.
  v_rejected := false;
  begin
    perform public.api_update_order_file_visibility(v_tenant_a, v_order_a, v_file_id, 'internal');
  exception
    when others then
      if sqlerrm like 'order_file.not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;
  if not v_rejected then
    raise exception 'la visibilite d une ligne DEJA supprimee a pu etre modifiee (attendu order_file.not_found)';
  end if;

  -- La ligne SURVIT (trace), mais n apparait plus dans une lecture normale
  -- (deleted_at is null est le filtre implicite de tout ecran) : verifie ici
  -- par une lecture PRIVILEGIEE distincte de celle qu un ecran ferait.
  if not exists (select 1 from public.commercial_order_files where id = v_file_id and deleted_at is not null) then
    raise exception 'la ligne supprimee n a pas survecu en base (attendu : trace conservee, pas un hard delete)';
  end if;

  select count(*) into v_still_visible
    from public.commercial_order_files
   where id = v_file_id and deleted_at is null;
  if v_still_visible <> 0 then
    raise exception 'une ligne supprimee reste comptee comme VIVANTE (deleted_at is null)';
  end if;
end;
$$;

-- ── 8. qa-review B1 — chemin forge REFUSE EN BASE (CHECK) SUR CE QU ELLE PEUT
--      VERIFIER, meme en ecriture PRIVILEGIEE (la contrainte ne depend
--      d aucun role) — ET LIMITE DOCUMENTEE, PROUVEE PLUTOT QU AFFIRMEE ────
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_order_a uuid;
  v_order_b uuid;
  v_rejected boolean := false;
begin
  select tenant_a, tenant_b, order_a, order_b into v_tenant_a, v_tenant_b, v_order_a, v_order_b from e10_17a_context;

  -- 8a. order_id/id INCORRECTS (ne correspondant pas a CETTE ligne) : la
  -- contrainte VERIFIE ces deux segments EN VALEUR (ce sont des colonnes de
  -- la ligne elle-meme) — refuse, meme en ecriture privilegiee.
  declare
    v_file_id uuid := gen_random_uuid();
    v_other_file_id uuid := gen_random_uuid();
  begin
    begin
      insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path)
        values (v_file_id, v_order_a, 'mauvais-order-id.pdf', 'application/pdf', 10,
                v_tenant_a::text || '/' || v_order_b::text || '/' || v_file_id::text);
    exception
      when check_violation then v_rejected := true;
    end;
    if not v_rejected then
      raise exception 'un storage_path portant un ORDER_ID different de la ligne a ete accepte (contrainte CHECK contournee sur un segment qu elle PEUT verifier)';
    end if;

    v_rejected := false;
    begin
      insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path)
        values (v_file_id, v_order_a, 'mauvais-file-id.pdf', 'application/pdf', 10,
                v_tenant_a::text || '/' || v_order_a::text || '/' || v_other_file_id::text);
    exception
      when check_violation then v_rejected := true;
    end;
    if not v_rejected then
      raise exception 'un storage_path portant un FILE_ID different de la ligne a ete accepte (contrainte CHECK contournee sur un segment qu elle PEUT verifier)';
    end if;
  end;

  -- 8a-bis. LIMITE DOCUMENTEE (contrat §8.19 §3, "la seconde barriere est
  -- PLUS FAIBLE ici qu en E10.10b-4a") : cette table NE PORTE PAS
  -- `tenant_id`, donc la contrainte NE PEUT PAS verifier la VALEUR du
  -- premier segment contre quoi que ce soit (un CHECK ne peut pas interroger
  -- une AUTRE table) — seule sa FORME (un UUID) est verifiee. Un chemin
  -- portant le BON order_id/id mais un tenant DIFFERENT, bien que canonique
  -- en FORME, est donc ACCEPTE par cette contrainte : ce test le PROUVE
  -- plutot que de le laisser decouvrir en qa-review. La VALEUR du tenant
  -- n est imposee QUE par la fonction `security definer`
  -- (`api_confirm_order_file_upload`), qui ne recoit jamais de parametre de
  -- chemin (scenario 5 ci-dessus) — jamais par cette contrainte, qui est une
  -- defense en profondeur PARTIELLE, pas totale, et le contrat le dit.
  declare
    v_file_id uuid := gen_random_uuid();
    v_accepted boolean := false;
  begin
    insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path)
      values (v_file_id, v_order_a, 'tenant-force-mais-forme-valide.pdf', 'application/pdf', 10,
              v_tenant_b::text || '/' || v_order_a::text || '/' || v_file_id::text);
    v_accepted := true;
    if not v_accepted then
      raise exception 'la limite documentee n a pas ete reproduite : le chemin a ete refuse (verifier si la contrainte a change de nature)';
    end if;
    -- Nettoyage : cette ligne ne sert qu a prouver la limite, elle ne doit
    -- pas fausser les scenarios suivants (plafond, listes, etc.).
    delete from public.commercial_order_files where id = v_file_id;
  end;

  -- 8b. Chemin hors format canonique (traversee de repertoire), meme a
  -- l interieur du bon tenant/de la bonne commande.
  v_rejected := false;
  declare
    v_file_id uuid := gen_random_uuid();
  begin
    begin
      insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path)
        values (v_file_id, v_order_a, 'traversee.pdf', 'application/pdf', 10,
                v_tenant_a::text || '/../../etc/passwd');
    exception
      when check_violation then v_rejected := true;
    end;
    if not v_rejected then
      raise exception 'un storage_path hors format canonique a ete accepte en base (contrainte CHECK contournee)';
    end if;
  end;

  -- 8c. Chemin CANONIQUE, bien forme : accepte (preuve que la contrainte
  -- filtre la FORME sans etre simplement une clause impossible a satisfaire).
  v_rejected := false;
  declare
    v_file_id uuid := gen_random_uuid();
  begin
    insert into public.commercial_order_files (id, order_id, filename, content_type, byte_size, storage_path)
      values (v_file_id, v_order_a, 'chemin-canonique.pdf', 'application/pdf', 10,
              v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text);
    if not found then
      null;
    end if;
  end;
end;
$$;

-- ── 9. Decision #11 — cle etrangere COMPOSITE, structurellement impossible ─
-- Insertion DIRECTE (privilegiee, bypass RLS ET bypass la fonction) citant
-- order_line_id d une AUTRE commande que order_id. qa-review N1 (corrige) :
-- le `storage_path` DOIT etre de FORME CANONIQUE (un UUID valide en premier
-- segment, meme fictif, suivi de order_id/file_id) pour que ce scenario ne
-- prouve QUE la cle etrangere composite — un chemin mal forme (l ancien
-- 'peu-importe/...') declenche `commercial_order_files_storage_path_shape`
-- AVANT meme d atteindre la FK, et un test qui accepte les deux exceptions
-- indistinctement ne demontre plus rien de la FK elle-meme : elle pourrait
-- disparaitre sans faire echouer ce scenario.
do $$
declare
  v_order_a uuid;
  v_order_line_b uuid;
  v_file_id uuid := gen_random_uuid();
  v_canonical_storage_path text;
  v_rejected boolean := false;
begin
  select order_a, order_line_b into v_order_a, v_order_line_b from e10_17a_context;
  -- Premier segment : n importe quel UUID FORME valide (aucune colonne
  -- tenant_id sur cette table, donc aucune valeur "correcte" a viser ici —
  -- seule la FORME compte pour ne pas declencher la contrainte de forme).
  v_canonical_storage_path := gen_random_uuid()::text || '/' || v_order_a::text || '/' || v_file_id::text;

  begin
    insert into public.commercial_order_files (id, order_id, order_line_id, filename, content_type, byte_size, storage_path)
      values (v_file_id, v_order_a, v_order_line_b, 'ligne-etrangere.pdf', 'application/pdf', 10, v_canonical_storage_path);
  exception
    when foreign_key_violation then v_rejected := true;
    when check_violation then
      raise exception 'le scenario a declenche la contrainte de FORME (check_violation) au lieu de la cle etrangere (foreign_key_violation) — storage_path n est pas de forme canonique, corriger le test plutot que d accepter les deux exceptions indistinctement (qa-review N1) : %', sqlerrm;
  end;

  if not v_rejected then
    raise exception 'une ligne d une AUTRE commande a ete inseree DIRECTEMENT (cle etrangere composite commercial_order_files_line_fk contournee)';
  end if;
end;
$$;

rollback;
