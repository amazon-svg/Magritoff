-- ============================================================================
-- E10.20a — lien public de depot et quatrieme mode d authentification : table
-- `commercial_order_upload_links`, RLS (isolation inter-tenant, ecriture
-- PostgREST DIRECTE bloquee pour tout role), quatre fonctions `api_*`
-- (creation, revocation, resolution de principal, contexte). Migration :
-- `20260910000300`. Contrat : docs/api/CONVENTIONS.md §8.21.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : la table, la
-- RLS et les quatre fonctions vivent ENTIEREMENT dans la migration
-- `20260910000300` — une lecture de son texte ne prouve pas qu elles se
-- comportent correctement sous appel reel (meme lecon que E10.17a/E10.14).
--
-- Scenarios :
--   1. Fixtures : tenant A (admin, member), tenant B (actor_b, stranger) ;
--      une commande du tenant A (order_a).
--   2. RLS lecture : le tenant B ne voit AUCUN lien de la commande du tenant
--      A ; un membre SANS capability particuliere voit NEANMOINS les liens
--      de SON PROPRE tenant (decision #4, aucune garde de capability).
--   3. RLS ecriture DIRECTE : AUCUN role applicatif (ni membre, ni admin) ne
--      peut INSERT/UPDATE/DELETE directement sur
--      `commercial_order_upload_links`.
--   4. `api_create_order_upload_link` : permission_denied pour un acteur
--      ETRANGER au tenant ; order.not_found pour une commande hors tenant ;
--      validation_failed pour expires_in_days/max_files hors bornes ;
--      creation reussie — le jeton rendu HACHE en sha256 EST le token_hash
--      persiste (preuve que le jeton n est JAMAIS stocke en clair) ; un
--      label vide/blanc est normalise a NULL.
--   5. Plafond de 10 liens VIVANTS par commande SOUS VERROU — un lien
--      revoque ne compte plus, un lien expire (fabrique directement) non
--      plus.
--   6. `api_revoke_order_upload_link` : upload_link.not_found sur un lien
--      inconnu ; revocation reussie (revoked_at/revoked_by/
--      revoked_by_label poses, ligne CONSERVEE) ; rejouer la MEME
--      revocation echoue au meme titre (upload_link.not_found — un lien
--      revoque est indiscernable d un lien inconnu).
--   7. `api_resolve_order_upload_link_principal` (GRANT anon, STABLE) :
--      resout un jeton VALIDE (role anon, SANS JWT) ; ne resout RIEN pour
--      un jeton inconnu, un lien REVOQUE, ou un lien EXPIRE (fabrique
--      directement) — les trois causes rendent le MEME "aucune ligne"
--      (arbitrage (F), indistinction cote route).
--   8. `api_get_order_upload_link_context` (GRANT anon) : rend
--      printer_name/order_number/label/expires_at/max_files/
--      deposited_count corrects ; incremente use_count et pose
--      first_used_at/last_used_at a CHAQUE appel (first_used_at ne bouge
--      qu UNE fois) ; ne rend RIEN pour un jeton revoque/expire/inconnu.
--   9. Isolation croisee — CREER : l admin du tenant B ne peut pas creer un
--      lien sur une commande du tenant A (permission_denied), meme en
--      forcant p_tenant_id.
--   9bis. Isolation croisee — REVOQUER (qa-review round 1, N1 — le titre du
--      scenario 9 annoncait a tort couvrir aussi la revocation) : l admin du
--      tenant B ne peut pas revoquer un lien REEL du tenant A
--      (permission_denied), et le lien cible reste VIVANT apres la
--      tentative (pas d effet de bord).
--   10. RLS — role `anon`, AUCUNE identite (qa-review round 1, N2) : lit
--      ZERO ligne sur `commercial_order_upload_links` en SELECT direct,
--      `token_hash` inclus — seules les quatre fonctions `security definer`
--      y accedent.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_20a_context (
  actor_admin    uuid not null,
  actor_member   uuid not null,
  actor_b        uuid not null,
  actor_stranger uuid not null,
  tenant_a       uuid not null,
  tenant_b       uuid not null,
  order_a        uuid not null
);

grant select on e10_20a_context to authenticated;

-- ── 1. Fixtures, jouees en tant que postgres ────────────────────────────────
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
  v_quote_a uuid;
  v_quote_line_a uuid;
  v_order_a uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_admin, 'e10-20a-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_member, 'e10-20a-member@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-20a-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_stranger, 'e10-20a-stranger@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-20a-tenant-a', 'E10.20a Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-20a-tenant-b', 'E10.20a Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_member, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.20a Client A', '73282932000074') returning id into v_customer_a;

  insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant_a, v_customer_a, 'Projet E10.20a') returning id into v_project;

  insert into public.project_items (project_id, label, position) values (v_project, 'Item A', 0) returning id into v_item_a;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-99201', 'draft', '2099-01-01', true)
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
  values (v_tenant_a, v_customer_a, v_quote_a, 'CDE-2026-99201', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12)
  returning id into v_order_a;

  insert into e10_20a_context (
    actor_admin, actor_member, actor_b, actor_stranger, tenant_a, tenant_b, order_a
  ) values (
    v_actor_admin, v_actor_member, v_actor_b, v_actor_stranger, v_tenant_a, v_tenant_b, v_order_a
  );
end;
$$;

-- Un lien de reference, insere DIRECTEMENT en phase privilegiee (bypass
-- RLS), pour les scenarios de lecture (2) AVANT d exercer les fonctions.
do $$
declare
  v_order_a uuid;
begin
  select order_a into v_order_a from e10_20a_context;
  insert into public.commercial_order_upload_links (order_id, token_hash, expires_at)
    values (v_order_a, repeat('a', 64), now() + interval '30 days');
end;
$$;

-- ── 2. RLS lecture ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_b::text from e10_20a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_order_a uuid;
  v_visible integer;
begin
  select order_a into v_order_a from e10_20a_context;
  select count(*) into v_visible from public.commercial_order_upload_links where order_id = v_order_a;
  if v_visible <> 0 then
    raise exception 'le tenant B lit % lien(s) de depot du tenant A — commercial_order_upload_links_select rompue', v_visible;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_member::text from e10_20a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_order_a uuid;
  v_visible integer;
begin
  select order_a into v_order_a from e10_20a_context;
  select count(*) into v_visible from public.commercial_order_upload_links where order_id = v_order_a;
  if v_visible <> 1 then
    raise exception 'un membre du tenant proprietaire ne lit pas le lien de reference (attendu 1, lu %)', v_visible;
  end if;
end;
$$;

reset role;

-- ── 3. RLS ecriture DIRECTE — AUCUN role applicatif ne peut ecrire ─────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_20a_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_order_a uuid;
  v_rejected boolean := false;
begin
  select order_a into v_order_a from e10_20a_context;
  begin
    insert into public.commercial_order_upload_links (order_id, token_hash, expires_at)
      values (v_order_a, repeat('b', 64), now() + interval '30 days');
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'un ADMIN a pu INSERT directement (commercial_order_upload_links n est PAS ecrivable en PostgREST direct)';
  end if;

  v_rejected := false;
  begin
    update public.commercial_order_upload_links set max_files = 30 where order_id = v_order_a;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'un ADMIN a pu UPDATE directement (attendu insufficient_privilege)';
  end if;

  v_rejected := false;
  begin
    delete from public.commercial_order_upload_links where order_id = v_order_a;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'un ADMIN a pu DELETE directement (attendu insufficient_privilege)';
  end if;
end;
$$;

reset role;

-- ── 4. api_create_order_upload_link ─────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_stranger uuid;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, actor_stranger into v_tenant_a, v_order_a, v_actor_stranger from e10_20a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_stranger::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 10);
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un acteur ETRANGER au tenant a pu creer un lien (attendu permission_denied)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_20a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_create_order_upload_link(v_tenant_a, gen_random_uuid(), null, 30, 10);
  exception
    when others then
      if sqlerrm like 'order.not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'une commande inexistante a ete acceptee (attendu order.not_found)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin, order_a into v_tenant_a, v_actor_admin, v_order_a from e10_20a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    perform public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 14, 10);
  exception
    when others then
      if sqlerrm like 'api.validation_failed%' then v_rejected := true; else reset role; raise; end if;
  end;
  if not v_rejected then
    reset role;
    raise exception 'expires_in_days=14 (hors {7,30,90}) a ete accepte (attendu api.validation_failed)';
  end if;

  v_rejected := false;
  begin
    perform public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 31);
  exception
    when others then
      if sqlerrm like 'api.validation_failed%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;
  if not v_rejected then
    raise exception 'max_files=31 (hors bornes) a ete accepte (attendu api.validation_failed)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_row record;
  v_persisted_hash text;
  v_expected_hash text;
begin
  select tenant_a, actor_admin, order_a into v_tenant_a, v_actor_admin, v_order_a from e10_20a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, '  ', 30, 10);
  reset role;

  if v_row.label is not null then
    raise exception 'un label blanc n a pas ete normalise a NULL : %', v_row.label;
  end if;
  if v_row.max_files <> 10 then
    raise exception 'max_files inattendu : %', v_row.max_files;
  end if;
  if v_row.deposited_count <> 0 then
    raise exception 'deposited_count inattendu a la creation : %', v_row.deposited_count;
  end if;
  if v_row.token is null or v_row.token !~ '^[A-Za-z0-9_-]{32,128}$' then
    raise exception 'jeton rendu hors forme attendue : %', v_row.token;
  end if;

  -- Preuve que le jeton n est JAMAIS stocke en clair : seule son empreinte
  -- sha256 hexadecimale doit correspondre a token_hash.
  select token_hash into v_persisted_hash from public.commercial_order_upload_links where id = v_row.id;
  select encode(digest(convert_to(v_row.token, 'UTF8'), 'sha256'), 'hex') into v_expected_hash;
  if v_persisted_hash is distinct from v_expected_hash then
    raise exception 'token_hash persiste ne correspond pas a sha256(jeton rendu)';
  end if;
  if v_persisted_hash = v_row.token then
    raise exception 'le jeton semble stocke EN CLAIR (token_hash = token)';
  end if;
end;
$$;

-- ── 5. Plafond de 10 liens VIVANTS, SOUS VERROU ─────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_existing integer;
  v_i integer;
  v_last_link_id uuid;
  v_row record;
  v_rejected boolean := false;
  v_expired_id uuid;
begin
  select tenant_a, actor_admin, order_a into v_tenant_a, v_actor_admin, v_order_a from e10_20a_context;

  -- Un lien EXPIRE (fabrique directement, bypass privilegie) ne doit pas
  -- compter dans le plafond.
  insert into public.commercial_order_upload_links (order_id, token_hash, expires_at, created_at)
    values (v_order_a, repeat('c', 64), now() - interval '1 day', now() - interval '31 days')
    returning id into v_expired_id;

  select count(*) into v_existing
    from public.commercial_order_upload_links
   where order_id = v_order_a and revoked_at is null and expires_at > now();

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  for v_i in 1..(10 - v_existing) loop
    select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 10);
    v_last_link_id := v_row.id;
  end loop;

  begin
    perform public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 10);
  exception
    when others then
      if sqlerrm like 'upload_link.limit_reached%' then v_rejected := true; else reset role; raise; end if;
  end;

  if not v_rejected then
    reset role;
    raise exception 'un 11e lien vivant a ete cree (attendu upload_link.limit_reached)';
  end if;

  -- Revoquer un lien libere une place.
  perform public.api_revoke_order_upload_link(v_tenant_a, v_order_a, v_last_link_id);
  perform public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 10);
  reset role;
end;
$$;

-- ── 6. api_revoke_order_upload_link ─────────────────────────────────────────
-- NOTE : le scenario 5 laisse `order_a` a EXACTEMENT 10 liens vivants (plafond
-- atteint) — ce scenario doit donc REVOQUER un lien EXISTANT avant de pouvoir
-- en creer un nouveau, sans quoi la creation ci-dessous heurterait le meme
-- plafond que celui prouve au scenario precedent.
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_freed_link_id uuid;
  v_row record;
  v_revoked record;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin, order_a into v_tenant_a, v_actor_admin, v_order_a from e10_20a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    perform public.api_revoke_order_upload_link(v_tenant_a, v_order_a, gen_random_uuid());
  exception
    when others then
      if sqlerrm like 'upload_link.not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  if not v_rejected then
    reset role;
    raise exception 'un lien inexistant a ete revoque (attendu upload_link.not_found)';
  end if;

  -- Libere une place (voir NOTE ci-dessus) avant la creation du lien propre
  -- a ce scenario.
  select id into v_freed_link_id
    from public.commercial_order_upload_links
   where order_id = v_order_a and revoked_at is null and expires_at > now()
   limit 1;
  perform public.api_revoke_order_upload_link(v_tenant_a, v_order_a, v_freed_link_id);

  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, 'a revoquer', 7, 5);
  select * into v_revoked from public.api_revoke_order_upload_link(v_tenant_a, v_order_a, v_row.id);

  if v_revoked.revoked_at is null then
    raise exception 'revoked_at non pose par api_revoke_order_upload_link';
  end if;
  if v_revoked.revoked_by is distinct from v_actor_admin then
    raise exception 'revoked_by inattendu : % (attendu %)', v_revoked.revoked_by, v_actor_admin;
  end if;
  if v_revoked.revoked_by_label is distinct from 'e10-20a-admin@example.test' then
    raise exception 'revoked_by_label inattendu : %', v_revoked.revoked_by_label;
  end if;

  -- Rejouer la MEME revocation echoue au meme titre : un lien revoque est
  -- indiscernable d un lien inconnu (contrat, arbitrage (F)).
  v_rejected := false;
  begin
    perform public.api_revoke_order_upload_link(v_tenant_a, v_order_a, v_row.id);
  exception
    when others then
      if sqlerrm like 'upload_link.not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;
  if not v_rejected then
    raise exception 'une revocation rejouee sur un lien DEJA revoque a reussi (attendu upload_link.not_found)';
  end if;

  -- La ligne SURVIT (trace), meme si elle a quitte la liste des vivants.
  if not exists (select 1 from public.commercial_order_upload_links where id = v_row.id and revoked_at is not null) then
    raise exception 'la ligne revoquee n a pas survecu en base (attendu : trace conservee)';
  end if;
end;
$$;

-- ── 7. api_resolve_order_upload_link_principal (GRANT anon, STABLE) ────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_row record;
  v_resolved record;
  v_count integer;
begin
  select tenant_a, order_a, actor_admin into v_tenant_a, v_order_a, v_actor_admin from e10_20a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, 'pour resolution', 30, 10);
  reset role;

  -- Role anon, SANS AUCUN JWT : c est le regime reel du porteur du lien.
  set local role anon;
  perform set_config('request.jwt.claims', '', true);

  select * into v_resolved from public.api_resolve_order_upload_link_principal(v_row.token);
  if v_resolved.link_id is distinct from v_row.id then
    raise exception 'api_resolve_order_upload_link_principal n a pas resolu le bon lien : % (attendu %)', v_resolved.link_id, v_row.id;
  end if;
  if v_resolved.order_id is distinct from v_order_a then
    raise exception 'order_id resolu inattendu : %', v_resolved.order_id;
  end if;
  if v_resolved.tenant_id is distinct from v_tenant_a then
    raise exception 'tenant_id resolu inattendu : %', v_resolved.tenant_id;
  end if;

  select count(*) into v_count from public.api_resolve_order_upload_link_principal('jeton-qui-n-existe-pas-00000000000000000000000000');
  if v_count <> 0 then
    raise exception 'un jeton INCONNU a ete resolu (attendu aucune ligne)';
  end if;

  reset role;

  -- Lien REVOQUE : plus resolu.
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.api_revoke_order_upload_link(v_tenant_a, v_order_a, v_row.id);
  reset role;

  set local role anon;
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_count from public.api_resolve_order_upload_link_principal(v_row.token);
  reset role;
  if v_count <> 0 then
    raise exception 'un jeton REVOQUE a ete resolu (attendu aucune ligne)';
  end if;
end;
$$;

do $$
declare
  v_order_a uuid;
  v_expired_id uuid := gen_random_uuid();
  v_token text := 'e10-20a-expired-token-fixture-000000000';
  v_hash text;
  v_count integer;
begin
  select order_a into v_order_a from e10_20a_context;
  select encode(digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex') into v_hash;

  insert into public.commercial_order_upload_links (id, order_id, token_hash, expires_at, created_at)
    values (v_expired_id, v_order_a, v_hash, now() - interval '1 day', now() - interval '31 days');

  set local role anon;
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_count from public.api_resolve_order_upload_link_principal(v_token);
  reset role;
  if v_count <> 0 then
    raise exception 'un jeton EXPIRE a ete resolu (attendu aucune ligne)';
  end if;
end;
$$;

-- ── 8. api_get_order_upload_link_context (GRANT anon) ───────────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_order_number text;
  v_tenant_name text;
  v_row record;
  v_ctx1 record;
  v_ctx2 record;
  v_first_used_1 timestamptz;
  v_first_used_2 timestamptz;
begin
  select tenant_a, order_a, actor_admin into v_tenant_a, v_order_a, v_actor_admin from e10_20a_context;
  select number into v_order_number from public.commercial_orders where id = v_order_a;
  select name into v_tenant_name from public.tenants where id = v_tenant_a;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, 'votre BAT valide', 30, 7);
  reset role;

  set local role anon;
  perform set_config('request.jwt.claims', '', true);
  select * into v_ctx1 from public.api_get_order_upload_link_context(v_row.token);
  reset role;

  if v_ctx1.printer_name is distinct from v_tenant_name then
    raise exception 'printer_name inattendu : % (attendu %)', v_ctx1.printer_name, v_tenant_name;
  end if;
  if v_ctx1.order_number is distinct from v_order_number then
    raise exception 'order_number inattendu : % (attendu %)', v_ctx1.order_number, v_order_number;
  end if;
  if v_ctx1.label is distinct from 'votre BAT valide' then
    raise exception 'label inattendu : %', v_ctx1.label;
  end if;
  if v_ctx1.max_files <> 7 then
    raise exception 'max_files inattendu : %', v_ctx1.max_files;
  end if;
  if v_ctx1.deposited_count <> 0 then
    raise exception 'deposited_count inattendu : %', v_ctx1.deposited_count;
  end if;

  select first_used_at, use_count into v_first_used_1, v_row.use_count from public.commercial_order_upload_links where id = v_row.id;
  if v_first_used_1 is null then
    raise exception 'first_used_at non pose apres le premier appel de contexte';
  end if;
  if v_row.use_count <> 1 then
    raise exception 'use_count inattendu apres le premier appel : %', v_row.use_count;
  end if;

  -- Second appel : use_count s incremente, first_used_at NE BOUGE PAS.
  set local role anon;
  perform set_config('request.jwt.claims', '', true);
  select * into v_ctx2 from public.api_get_order_upload_link_context(v_row.token);
  reset role;

  select first_used_at into v_first_used_2 from public.commercial_order_upload_links where id = v_row.id;
  if v_first_used_2 is distinct from v_first_used_1 then
    raise exception 'first_used_at a bouge entre deux appels (attendu fige a la premiere ouverture)';
  end if;

  select use_count into v_row.use_count from public.commercial_order_upload_links where id = v_row.id;
  if v_row.use_count <> 2 then
    raise exception 'use_count inattendu apres le second appel : %', v_row.use_count;
  end if;

  -- Lien revoque : plus de contexte.
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.api_revoke_order_upload_link(v_tenant_a, v_order_a, v_row.id);
  reset role;

  declare
    v_count integer;
  begin
    set local role anon;
    perform set_config('request.jwt.claims', '', true);
    select count(*) into v_count from public.api_get_order_upload_link_context(v_row.token);
    reset role;
    if v_count <> 0 then
      raise exception 'un lien REVOQUE a rendu un contexte (attendu aucune ligne)';
    end if;
  end;
end;
$$;

-- ── 9. Isolation croisee — CREER (n1, qa-review round 1) ────────────────────
do $$
declare
  v_tenant_b uuid;
  v_order_a uuid;
  v_actor_b uuid;
  v_rejected boolean := false;
begin
  select tenant_b, order_a, actor_b into v_tenant_b, v_order_a, v_actor_b from e10_20a_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    -- L admin du tenant B tente de creer un lien sur une commande du
    -- tenant A, EN PRETENDANT que le tenant du jeton est le tenant A
    -- (p_tenant_id force) : la garde d appartenance doit refuser, jamais
    -- se fier au parametre.
    perform public.api_create_order_upload_link(
      (select tenant_a from e10_20a_context), v_order_a, null, 30, 10
    );
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'l admin du tenant B a pu creer un lien sur une commande du tenant A (attendu permission_denied)';
  end if;
end;
$$;

-- ── 9bis. Isolation croisee — REVOQUER (n1, qa-review round 1 : le titre du
--         scenario 9 annoncait "ni creer ni revoquer" mais ne testait QUE la
--         creation ; ce bloc ferme la couverture manquante, verifiee
--         separement par la qa-review et desormais prouvee ICI) ────────────
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_actor_b uuid;
  v_link_id uuid;
  v_rejected boolean := false;
begin
  select tenant_a, tenant_b, order_a, actor_admin, actor_b
    into v_tenant_a, v_tenant_b, v_order_a, v_actor_admin, v_actor_b
    from e10_20a_context;

  -- Un lien REEL, emis legitimement par le tenant proprietaire, pour que ce
  -- scenario ne prouve pas seulement "aucun lien a revoquer" mais bien
  -- "un lien EXISTANT, appartenant a l AUTRE tenant, refuse".
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into v_link_id from public.api_create_order_upload_link(v_tenant_a, v_order_a, 'cible isolation', 30, 10);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    -- L admin du tenant B tente de revoquer un lien REEL du tenant A, EN
    -- PRETENDANT que le tenant du jeton est le tenant A (p_tenant_id force,
    -- meme discipline que le scenario 9 pour la creation).
    perform public.api_revoke_order_upload_link(v_tenant_a, v_order_a, v_link_id);
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'l admin du tenant B a pu revoquer un lien REEL du tenant A (attendu permission_denied)';
  end if;

  -- Preuve que le refus est bien un permission_denied et pas un simple
  -- upload_link.not_found : le lien reste VIVANT apres la tentative.
  if exists (
    select 1 from public.commercial_order_upload_links
     where id = v_link_id and revoked_at is not null
  ) then
    raise exception 'le lien du tenant A a ete revoque malgre le refus attendu (effet de bord inattendu)';
  end if;
end;
$$;

-- ── 10. RLS — le role `anon` ne lit RIEN sur cette table, `token_hash`
--        compris (n2, qa-review round 1 : verifie separement par la
--        qa-review, desormais prouve ICI) ─────────────────────────────────
do $$
declare
  v_visible integer;
begin
  -- `set_config('request.jwt.claims', ..., true)` est TRANSACTIONNEL, pas
  -- local au bloc : sans l effacer explicitement ici, les claims posees au
  -- scenario 9bis (actor_b) survivraient sous ce `set local role anon`, et
  -- ce test verifierait alors l isolation tenant sous le nom `anon` plutot
  -- que le regime reel d un porteur de lien (qui n a AUCUNE identite) —
  -- ecart trouve et corrige en qa-review round 2.
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  select count(*) into v_visible from public.commercial_order_upload_links;
  reset role;

  if v_visible <> 0 then
    raise exception 'le role anon lit % ligne(s) de commercial_order_upload_links en SELECT direct (attendu 0 — seules les quatre fonctions security definer y accedent)', v_visible;
  end if;
end;
$$;

rollback;
