-- ============================================================================
-- E10.20b — le depot par le lien public : `commercial_order_files.
-- deposited_via`, fonction `api_confirm_order_file_upload_by_link` (SECONDE
-- fonction de confirmation, DISTINCTE d `api_confirm_order_file_upload`),
-- verrou CONSULTATIF PARTAGE avec la voie d atelier, deux plafonds qui se
-- CUMULENT. Migration : `20260910000400`. Contrat :
-- docs/api/CONVENTIONS.md §8.21/§8bis.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : la fonction
-- vit ENTIEREMENT dans la migration `20260910000400` — une lecture de son
-- texte ne prouve pas qu elle se comporte correctement sous appel reel (meme
-- lecon que E10.17a/E10.20a).
--
-- qa-review round 1 (B1, BLOQUANT SECURITE, faille exploitee reellement) —
-- CE FICHIER PORTE DESORMAIS LA PREUVE DU CORRECTIF : la version initiale
-- de `api_confirm_order_file_upload_by_link` etait GRANT `anon` et faisait
-- confiance a des parametres `p_content_type`/`p_byte_size` fournis par
-- l appelant. Corrigee en DEUX temps, cumulatifs : (i) GRANT `service_role`
-- UNIQUEMENT (ni `anon`, ni `authenticated`, ni `public`) ; (ii) la fonction
-- ne recoit PLUS ces deux parametres et RELIT elle-meme l objet REEL dans
-- `storage.objects`/`storage.buckets`. Les scenarios 2bis/2ter/2quater
-- prouvent chacun un des deux correctifs par exploitation reelle (pas
-- theorique) : appel direct sous `anon` refuse au niveau GRANT, objet ABSENT
-- refuse, objet PRESENT mais de type/poids illegitimes refuse — CES DEUX
-- DERNIERS via une insertion DIRECTE dans `storage.objects` (le PUT normal
-- ne peut pas produire un tel objet, le bucket lui-meme refuse deja ces cas
-- a l upload : la fonction doit rester correcte MEME si une ligne
-- illegitime entrait par un autre chemin que le PUT standard).
--
-- Scenarios :
--   1. Fixtures : tenant A (admin), tenant B (commande non utilisee ici,
--      seulement pour prouver l absence de fuite) ; une commande du tenant A
--      (order_a), un lien VIVANT sur cette commande (max_files=2).
--   2. `api_confirm_order_file_upload_by_link` — jeton INVALIDE (inconnu,
--      expire, revoque) rend TOUS upload_link.invalid, sans distinction.
--   2bis. GRANT (qa-review B1) — `anon` ne peut PAS appeler la fonction du
--      tout : `insufficient_privilege`, AVANT meme que le jeton soit
--      examine. `authenticated` non plus. Seul `service_role` l atteint.
--   2ter. DEFENSE EN PROFONDEUR (qa-review B1) — aucun objet depose au
--      chemin attendu : `order_file.upload_missing`, meme sous
--      `service_role` avec un jeton et un file_id valides.
--   2quater. DEFENSE EN PROFONDEUR (qa-review B1) — un objet EXISTE au bon
--      chemin (insere DIRECTEMENT dans `storage.objects`, hors du PUT
--      normal) mais son type reel est hors de la liste fermee, ou son poids
--      reel depasse le plafond du bucket : `order_file.rejected` dans les
--      deux cas, la fonction RELIT ces valeurs de l objet, jamais d un
--      parametre (qu elle n accepte d ailleurs plus).
--   3. Confirmation reussie (objet REEL prealablement depose dans
--      `storage.objects`) : ligne creee, deposited_by NUL,
--      deposited_by_label COMPOSE depuis le label du lien
--      ("Dépôt client — <label>"), deposited_via = 'upload_link',
--      visibility TOUJOURS 'internal', order_line_id TOUJOURS NUL,
--      content_type/byte_size ECRITS DEPUIS L OBJET REEL (pas un parametre).
--      deposited_count du lien INCREMENTE ATOMIQUEMENT (0 -> 1).
--   4. Un file_id deja confirme ne l est jamais deux fois
--      (order_file.already_confirmed, code REUTILISE d E10.17a).
--   5. Plafond PROPRE au lien (max_files=2) : le 3e depot est refuse
--      (upload_link.file_limit_reached).
--   6. Plafond de la COMMANDE (30 fichiers vivants, INCHANGE depuis
--      E10.17a) : un lien au max_files large (30) mais une commande deja a
--      30 fichiers vivants (poses par la voie ATELIER,
--      api_confirm_order_file_upload) refuse le depot par lien AU MEME
--      TITRE (upload_link.file_limit_reached) — preuve que les deux voies
--      d entree PARTAGENT le MEME budget.
--   7. Libelle SANS consigne : "Dépôt client par lien" (lien sans label).
--   8. Isolation — le porteur du lien de la commande du TENANT A ne peut
--      jamais faire apparaitre un fichier sur une commande du TENANT B
--      (structurellement impossible : le chemin est recalcule depuis le
--      TENANT DE LA COMMANDE resolue par le LIEN, jamais un parametre).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_20b_context (
  actor_admin uuid not null,
  tenant_a    uuid not null,
  tenant_b    uuid not null,
  order_a     uuid not null,
  order_b     uuid not null,
  -- Commande LIBRE (aucun fichier), pour les scenarios 7/8 qui doivent
  -- s executer APRES que le scenario 6 a sature le budget de order_a.
  order_c     uuid not null
);

grant select on e10_20b_context to authenticated, anon, service_role;

-- ── 1. Fixtures ──────────────────────────────────────────────────────────
do $$
declare
  v_actor_admin uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_quote_a uuid;
  v_quote_b uuid;
  v_quote_line_a uuid;
  v_quote_line_b uuid;
  v_quote_c uuid;
  v_quote_line_c uuid;
  v_order_a uuid;
  v_order_b uuid;
  v_order_c uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_actor_admin, 'e10-20b-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-20b-tenant-a', 'E10.20b Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-20b-tenant-b', 'E10.20b Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.20b Client A', '73282932000074') returning id into v_customer_a;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_b, 'company', 'E10.20b Client B', '81351184300012') returning id into v_customer_b;

  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a, 'Projet A') returning id into v_project_a;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_b, v_customer_b, 'Projet B') returning id into v_project_b;

  insert into public.project_items (project_id, label, position) values (v_project_a, 'Item A', 0) returning id into v_item_a;
  insert into public.project_items (project_id, label, position) values (v_project_b, 'Item B', 0) returning id into v_item_b;

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-99301', 'draft', '2099-01-01', true) returning id into v_quote_a;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_b, v_customer_b, v_project_b, 'DEV-2026-99302', 'draft', '2099-01-01', true) returning id into v_quote_b;

  insert into public.commercial_quote_lines (
    quote_id, project_item_id, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
  ) values (v_quote_a, v_item_a, 'Ligne A', 10, 0, 5, 5, 5, 0, 5, '[{"label":"production"}]'::jsonb) returning id into v_quote_line_a;
  insert into public.commercial_quote_lines (
    quote_id, project_item_id, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
  ) values (v_quote_b, v_item_b, 'Ligne B', 10, 0, 5, 5, 5, 0, 5, '[{"label":"production"}]'::jsonb) returning id into v_quote_line_b;

  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax
  )
  values (v_tenant_a, v_customer_a, v_quote_a, 'CDE-2026-99301', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12)
  returning id into v_order_a;

  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax
  )
  values (v_tenant_b, v_customer_b, v_quote_b, 'CDE-2026-99302', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12)
  returning id into v_order_b;

  -- Commande C — meme tenant/client/projet que A, mais SANS AUCUN fichier :
  -- les scenarios 7/8 l utilisent pour ne pas heurter le plafond de 30
  -- deja sature sur order_a par le scenario 6.
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-2026-99303', 'draft', '2099-01-01', true) returning id into v_quote_c;
  insert into public.commercial_quote_lines (
    quote_id, project_item_id, label, quantity, position,
    production_price, public_price, customer_price, applied_margin_rate, sale_price, breakdown
  ) values (v_quote_c, v_item_a, 'Ligne C', 10, 0, 5, 5, 5, 0, 5, '[{"label":"production"}]'::jsonb) returning id into v_quote_line_c;
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax
  )
  values (v_tenant_a, v_customer_a, v_quote_c, 'CDE-2026-99303', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12)
  returning id into v_order_c;

  insert into e10_20b_context (actor_admin, tenant_a, tenant_b, order_a, order_b, order_c)
    values (v_actor_admin, v_tenant_a, v_tenant_b, v_order_a, v_order_b, v_order_c);
end;
$$;

-- ── 2. Jeton invalide (inconnu, expire, revoque) — TOUS upload_link.invalid ─
-- Appelee sous `service_role` (seul role habilite depuis le correctif B1) :
-- meme sous ce role, un jeton invalide reste refuse AVANT tout examen d
-- objet.
do $$
declare
  v_count integer;
begin
  set local role service_role;
  select count(*) into v_count from public.api_confirm_order_file_upload_by_link(
    'jeton-inconnu-000000000000000000000000000000', gen_random_uuid(), 'x.pdf'
  );
  reset role;
  -- Cette fonction RAISE (ne rend jamais un ensemble vide) : le test doit
  -- attraper l exception, pas lire un compte.
  raise exception 'un jeton inconnu aurait du lever upload_link.invalid, aucune exception levee';
exception
  when others then
    if sqlerrm not like 'upload_link.invalid%' then
      raise;
    end if;
end;
$$;

do $$
declare
  v_order_a uuid;
  v_expired_id uuid := gen_random_uuid();
  v_token text := 'e10-20b-expired-token-fixture-0000000000';
  v_hash text;
  v_rejected boolean := false;
begin
  select order_a into v_order_a from e10_20b_context;
  select encode(digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex') into v_hash;

  insert into public.commercial_order_upload_links (id, order_id, token_hash, expires_at, created_at)
    values (v_expired_id, v_order_a, v_hash, now() - interval '1 day', now() - interval '31 days');

  set local role service_role;
  begin
    perform public.api_confirm_order_file_upload_by_link(v_token, gen_random_uuid(), 'x.pdf');
  exception
    when others then
      if sqlerrm like 'upload_link.invalid%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un jeton EXPIRE a ete accepte par api_confirm_order_file_upload_by_link (attendu upload_link.invalid)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_row record;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, actor_admin into v_tenant_a, v_order_a, v_actor_admin from e10_20b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 10);
  perform public.api_revoke_order_upload_link(v_tenant_a, v_order_a, v_row.id);
  reset role;

  set local role service_role;
  begin
    perform public.api_confirm_order_file_upload_by_link(v_row.token, gen_random_uuid(), 'x.pdf');
  exception
    when others then
      if sqlerrm like 'upload_link.invalid%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un jeton REVOQUE a ete accepte par api_confirm_order_file_upload_by_link (attendu upload_link.invalid)';
  end if;
end;
$$;

-- ── 2bis. GRANT (qa-review round 1, B1, BLOQUANT SECURITE) — SEUL
--         service_role atteint cette fonction ; ni anon (l exploitation
--         reelle prouvee par la qa-review), ni authenticated ─────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_row record;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, actor_admin into v_tenant_a, v_order_a, v_actor_admin from e10_20b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 10);
  reset role;

  -- EXPLOITATION REELLEMENT PROUVEE PAR LA QA-REVIEW : appel direct sous
  -- `anon`, la cle PUBLIQUE du bundle front, avec un jeton de lien
  -- LEGITIME. Doit desormais echouer au niveau du GRANT, avant meme que le
  -- jeton soit examine.
  set local role anon;
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.api_confirm_order_file_upload_by_link(v_row.token, gen_random_uuid(), 'facture-verolee.exe');
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  reset role;

  if not v_rejected then
    raise exception 'FAILLE NON CORRIGEE : la cle anon a pu appeler api_confirm_order_file_upload_by_link (attendu insufficient_privilege)';
  end if;

  -- `authenticated` (un jeton utilisateur Magrit quelconque) ne l atteint
  -- pas non plus : cette operation n a de sens que pour service_role, agi
  -- au nom d un porteur de lien qui n a par construction aucun JWT Magrit.
  v_rejected := false;
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_confirm_order_file_upload_by_link(v_row.token, gen_random_uuid(), 'x.pdf');
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un jeton UTILISATEUR authenticated a pu appeler api_confirm_order_file_upload_by_link directement (attendu insufficient_privilege — GRANT service_role uniquement)';
  end if;
end;
$$;

-- ── 2ter. DEFENSE EN PROFONDEUR (qa-review B1) — AUCUN objet depose ────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_row record;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, actor_admin into v_tenant_a, v_order_a, v_actor_admin from e10_20b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 10);
  reset role;

  -- MEME sous service_role (le seul role habilite), avec un jeton et un
  -- file_id parfaitement valides : AUCUN octet n a ete depose au chemin
  -- attendu -> refus. C est la garde qui ferme l exploitation prouvee (une
  -- ligne fantome ne peut plus exister sans objet reel).
  set local role service_role;
  begin
    perform public.api_confirm_order_file_upload_by_link(v_row.token, gen_random_uuid(), 'facture-verolee.exe');
  exception
    when others then
      if sqlerrm like 'order_file.upload_missing%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'FAILLE NON CORRIGEE : une ligne fantome a ete creee SANS AUCUN OBJET DEPOSE (attendu order_file.upload_missing)';
  end if;

  if exists (select 1 from public.commercial_order_files where filename = 'facture-verolee.exe') then
    raise exception 'FAILLE NON CORRIGEE : une ligne fantome persiste en base malgre le refus';
  end if;
end;
$$;

-- ── 2quater. DEFENSE EN PROFONDEUR (qa-review B1) — objet PRESENT mais
--            type/poids reels illegitimes, INSERE DIRECTEMENT dans
--            `storage.objects` (le PUT normal ne peut pas produire un tel
--            objet, le bucket refuse deja ces cas — cette insertion directe
--            teste la fonction INDEPENDAMMENT de la source de la ligne) ───
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_row record;
  v_bad_type_file_id uuid := gen_random_uuid();
  v_bad_size_file_id uuid := gen_random_uuid();
  v_rejected boolean := false;
begin
  select tenant_a, order_a, actor_admin into v_tenant_a, v_order_a, v_actor_admin from e10_20b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 10);
  reset role;

  -- Type hors de la liste fermee (`allowed_mime_types` du bucket) : la
  -- fonction RELIT ce type depuis l objet REEL, jamais un parametre
  -- (qu elle n accepte plus).
  insert into storage.objects (bucket_id, name, metadata)
  values (
    'commercial_order_files',
    v_tenant_a::text || '/' || v_order_a::text || '/' || v_bad_type_file_id::text,
    jsonb_build_object('size', 1024, 'mimetype', 'application/x-msdownload')
  );

  set local role service_role;
  begin
    perform public.api_confirm_order_file_upload_by_link(v_row.token, v_bad_type_file_id, 'facture-verolee.exe');
  exception
    when others then
      if sqlerrm like 'order_file.rejected%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'FAILLE NON CORRIGEE : un objet de type application/x-msdownload a ete accepte (attendu order_file.rejected)';
  end if;
  if exists (select 1 from public.commercial_order_files where id = v_bad_type_file_id) then
    raise exception 'FAILLE NON CORRIGEE : une ligne a ete creee pour un type de fichier non accepte';
  end if;

  -- Poids reel MENSONGER (1 To), type par ailleurs accepte : la fonction
  -- RELIT ce poids depuis l objet REEL, jamais un parametre.
  v_rejected := false;
  insert into storage.objects (bucket_id, name, metadata)
  values (
    'commercial_order_files',
    v_tenant_a::text || '/' || v_order_a::text || '/' || v_bad_size_file_id::text,
    jsonb_build_object('size', 999999999999, 'mimetype', 'application/pdf')
  );

  set local role service_role;
  begin
    perform public.api_confirm_order_file_upload_by_link(v_row.token, v_bad_size_file_id, 'enorme.pdf');
  exception
    when others then
      if sqlerrm like 'order_file.rejected%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'FAILLE NON CORRIGEE : un objet de 999999999999 octets a ete accepte (attendu order_file.rejected)';
  end if;
  if exists (select 1 from public.commercial_order_files where id = v_bad_size_file_id) then
    raise exception 'FAILLE NON CORRIGEE : une ligne a ete creee pour un poids hors bornes';
  end if;

  -- Le lien n a ete debite d AUCUN de ces deux depots refuses : deux
  -- causes de refus differentes (type, poids), zero effet de bord.
  if (select deposited_count from public.commercial_order_upload_links where id = v_row.id) <> 0 then
    raise exception 'deposited_count du lien a bouge alors que les deux depots ont ete refuses';
  end if;
end;
$$;

-- ── 3. Confirmation reussie — modele d auteur, deposited_via, plafond ──────
-- L objet est REELLEMENT depose dans `storage.objects` AVANT confirmation
-- (insertion directe ici, equivalent d un `PUT` reussi sur l URL signee) :
-- la fonction ne peut plus rien confirmer sans preuve reelle du depot.
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_row record;
  v_file_id uuid := gen_random_uuid();
  v_confirmed record;
  v_persisted record;
begin
  select tenant_a, order_a, actor_admin into v_tenant_a, v_order_a, v_actor_admin from e10_20b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, 'votre BAT', 30, 2);
  reset role;

  insert into storage.objects (bucket_id, name, metadata)
  values (
    'commercial_order_files',
    v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text,
    jsonb_build_object('size', 2048, 'mimetype', 'application/pdf')
  );

  set local role service_role;
  select * into v_confirmed from public.api_confirm_order_file_upload_by_link(v_row.token, v_file_id, 'bat.pdf');
  reset role;

  if v_confirmed.file_id is distinct from v_file_id then
    raise exception 'file_id rendu inattendu : % (attendu %)', v_confirmed.file_id, v_file_id;
  end if;
  if v_confirmed.content_type is distinct from 'application/pdf' then
    raise exception 'content_type rendu inattendu (attendu relu de l objet reel) : %', v_confirmed.content_type;
  end if;
  if v_confirmed.byte_size <> 2048 then
    raise exception 'byte_size rendu inattendu (attendu relu de l objet reel) : %', v_confirmed.byte_size;
  end if;
  if v_confirmed.deposited_count <> 1 then
    raise exception 'deposited_count rendu inattendu apres le premier depot : %', v_confirmed.deposited_count;
  end if;
  if v_confirmed.max_files <> 2 then
    raise exception 'max_files rendu inattendu : %', v_confirmed.max_files;
  end if;
  if v_confirmed.upload_link_id is distinct from v_row.id then
    raise exception 'upload_link_id rendu inattendu : %', v_confirmed.upload_link_id;
  end if;
  if v_confirmed.order_id is distinct from v_order_a then
    raise exception 'order_id rendu inattendu : %', v_confirmed.order_id;
  end if;
  if v_confirmed.customer_id is null then
    raise exception 'customer_id non rendu';
  end if;

  select * into v_persisted from public.commercial_order_files where id = v_file_id;
  if v_persisted.deposited_by is not null then
    raise exception 'deposited_by aurait du rester NUL (deposant non-utilisateur) : %', v_persisted.deposited_by;
  end if;
  if v_persisted.deposited_by_label is distinct from 'Dépôt client — votre BAT' then
    raise exception 'deposited_by_label inattendu : %', v_persisted.deposited_by_label;
  end if;
  if v_persisted.deposited_via is distinct from 'upload_link' then
    raise exception 'deposited_via inattendu : %', v_persisted.deposited_via;
  end if;
  if v_persisted.visibility is distinct from 'internal' then
    raise exception 'visibility aurait du rester internal : %', v_persisted.visibility;
  end if;
  if v_persisted.order_line_id is not null then
    raise exception 'order_line_id aurait du rester NUL (le porteur du lien ne choisit pas la ligne) : %', v_persisted.order_line_id;
  end if;
  if v_persisted.content_type is distinct from 'application/pdf' or v_persisted.byte_size <> 2048 then
    raise exception 'content_type/byte_size persistes ne correspondent pas a l objet REEL (% / %)', v_persisted.content_type, v_persisted.byte_size;
  end if;

  -- Le compteur du LIEN est incremente ATOMIQUEMENT en base, pas seulement
  -- dans la valeur rendue par la fonction.
  if (select deposited_count from public.commercial_order_upload_links where id = v_row.id) <> 1 then
    raise exception 'deposited_count du lien non incremente en base';
  end if;

  -- ── 4. Meme file_id confirme deux fois -> order_file.already_confirmed ──
  declare
    v_rejected boolean := false;
  begin
    set local role service_role;
    begin
      perform public.api_confirm_order_file_upload_by_link(v_row.token, v_file_id, 'bat.pdf');
    exception
      when others then
        if sqlerrm like 'order_file.already_confirmed%' then v_rejected := true; else reset role; raise; end if;
    end;
    reset role;
    if not v_rejected then
      raise exception 'un file_id deja confirme a ete accepte une seconde fois (attendu order_file.already_confirmed)';
    end if;
  end;

  -- ── 5. Plafond PROPRE au lien (max_files=2) ──────────────────────────────
  declare
    v_second_file_id uuid := gen_random_uuid();
    v_third_file_id uuid := gen_random_uuid();
    v_rejected boolean := false;
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values (
      'commercial_order_files',
      v_tenant_a::text || '/' || v_order_a::text || '/' || v_second_file_id::text,
      jsonb_build_object('size', 512, 'mimetype', 'application/pdf')
    );

    set local role service_role;
    perform public.api_confirm_order_file_upload_by_link(v_row.token, v_second_file_id, 'deux.pdf');
    reset role;

    if (select deposited_count from public.commercial_order_upload_links where id = v_row.id) <> 2 then
      raise exception 'deposited_count du lien inattendu apres le second depot';
    end if;

    -- Plafond atteint AVANT meme l examen d un objet : le 3e depot est
    -- refuse qu un objet existe ou non a ce chemin (aucun n est depose ici).
    set local role service_role;
    begin
      perform public.api_confirm_order_file_upload_by_link(v_row.token, v_third_file_id, 'trois.pdf');
    exception
      when others then
        if sqlerrm like 'upload_link.file_limit_reached%' then v_rejected := true; else reset role; raise; end if;
    end;
    reset role;
    if not v_rejected then
      raise exception 'un 3e depot a ete accepte malgre max_files=2 (attendu upload_link.file_limit_reached)';
    end if;
  end;
end;
$$;

-- ── 6. Plafond de la COMMANDE (30 fichiers vivants), PARTAGE avec la voie
--        d atelier ──────────────────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_row record;
  v_new_file_id uuid := gen_random_uuid();
  v_i integer;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, actor_admin into v_tenant_a, v_order_a, v_actor_admin from e10_20b_context;

  -- Deux fichiers deja poses par la voie LIEN dans le scenario precedent :
  -- on complete jusqu a 30 VIVANTS par la voie ATELIER (api_confirm_order_
  -- file_upload, E10.17a, INCHANGEE — accepte encore ses propres parametres
  -- de type/poids, hors perimetre de ce correctif), pour prouver que les
  -- deux voies PARTAGENT le meme budget.
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for v_i in 1..28 loop
    perform public.api_confirm_order_file_upload(
      v_tenant_a, v_order_a, gen_random_uuid(), 'atelier-' || v_i || '.pdf', null, 'internal', 'application/pdf', 100
    );
  end loop;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 30);
  reset role;

  if (select count(*) from public.commercial_order_files where order_id = v_order_a and deleted_at is null) <> 30 then
    raise exception 'la commande devrait porter exactement 30 fichiers vivants avant ce scenario';
  end if;

  -- Plafond de la commande atteint AVANT l examen d un objet : aucun objet
  -- n est depose ici, et ce n est pas la cause du refus attendu.
  set local role service_role;
  begin
    perform public.api_confirm_order_file_upload_by_link(v_row.token, v_new_file_id, 'refuse.pdf');
  exception
    when others then
      if sqlerrm like 'upload_link.file_limit_reached%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un depot par lien a ete accepte alors que la commande portait deja 30 fichiers vivants (attendu upload_link.file_limit_reached)';
  end if;
end;
$$;

-- ── 7. Libelle SANS consigne : "Dépôt client par lien" ──────────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_customer_a uuid;
  v_row record;
  v_file_id uuid := gen_random_uuid();
  v_label text;
begin
  -- `order_c` : commande LIBRE de tout plafond, pour isoler ce scenario des
  -- compteurs deja satures sur `order_a` par les scenarios 5/6.
  select tenant_a, order_c, actor_admin into v_tenant_a, v_order_a, v_actor_admin from e10_20b_context;
  select customer_id into v_customer_a from public.commercial_orders where id = v_order_a;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 30);
  reset role;

  insert into storage.objects (bucket_id, name, metadata)
  values (
    'commercial_order_files',
    v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text,
    jsonb_build_object('size', 256, 'mimetype', 'application/pdf')
  );

  -- Le lien de ce scenario porte deja `label is null` (creation sans
  -- consigne) : la fonction doit composer le second libelle du contrat.
  set local role service_role;
  perform public.api_confirm_order_file_upload_by_link(v_row.token, v_file_id, 'sans-label.pdf');
  reset role;

  select deposited_by_label into v_label from public.commercial_order_files where id = v_file_id;
  if v_label is distinct from 'Dépôt client par lien' then
    raise exception 'deposited_by_label inattendu pour un lien sans consigne : %', v_label;
  end if;
end;
$$;

-- ── 8. Isolation — le chemin est TOUJOURS recalcule depuis le TENANT DE LA
--        COMMANDE resolue par le lien, jamais un parametre ─────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_actor_admin uuid;
  v_row record;
  v_file_id uuid := gen_random_uuid();
  v_confirmed record;
begin
  select tenant_a, order_c, actor_admin into v_tenant_a, v_order_a, v_actor_admin from e10_20b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into v_row from public.api_create_order_upload_link(v_tenant_a, v_order_a, null, 30, 30);
  reset role;

  insert into storage.objects (bucket_id, name, metadata)
  values (
    'commercial_order_files',
    v_tenant_a::text || '/' || v_order_a::text || '/' || v_file_id::text,
    jsonb_build_object('size', 100, 'mimetype', 'application/pdf')
  );

  set local role service_role;
  select * into v_confirmed from public.api_confirm_order_file_upload_by_link(v_row.token, v_file_id, 'isolation.pdf');
  reset role;

  -- Le fichier appartient EXCLUSIVEMENT a la commande resolue par LE LIEN
  -- (order_a, tenant_a) — cette fonction ne recoit ni orderId ni tenantId en
  -- parametre, il est structurellement impossible qu elle fasse apparaitre
  -- un fichier ailleurs.
  if v_confirmed.order_id is distinct from v_order_a then
    raise exception 'le fichier est apparu sur une commande inattendue : %', v_confirmed.order_id;
  end if;
  if exists (
    select 1 from public.commercial_orders where id = v_confirmed.order_id and tenant_id <> v_tenant_a
  ) then
    raise exception 'la commande resolue n appartient pas au tenant attendu';
  end if;
end;
$$;

rollback;
