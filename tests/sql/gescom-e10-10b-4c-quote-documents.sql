-- ============================================================================
-- E10.10b-4c — moteur de generation et branchement : table `quote_documents`,
-- bucket prive, RLS (isolation inter-tenant, append-only, service_role
-- uniquement), trigger de coherence tenant, fonction
-- `api_get_storefront_quote_document`. Migration : 20260909040000. Contrat :
-- docs/api/CONVENTIONS.md §8.18, openapi/magrit-core.v1.yaml
-- (QuoteDocument, getQuoteDocument, getStorefrontQuoteDocument).
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : le seed, la
-- fonction, la RLS vivent ENTIEREMENT dans la migration 20260909040000 — une
-- lecture de son texte ne prouve pas qu ils se comportent correctement sous
-- appel reel (meme lecon que E10.10b-4a/4b).
--
-- Scenarios :
--   1. RLS lecture ATELIER : un membre du tenant B ne voit AUCUN document du
--      tenant A ; un membre du tenant A voit SON document.
--   2. APPEND-ONLY, service_role uniquement : un membre authentifie (admin
--      inclus) ne peut PAS inserer/mettre a jour/supprimer une ligne en
--      DIRECT, quel que soit son droit — seul service_role le peut (contrat
--      §8.18 §2).
--   3. Trigger de coherence tenant (qa-review B1, applique par anticipation) :
--      une insertion privilegiee (service_role, hors RLS) avec `quote_id`
--      d un AUTRE tenant que `tenant_id` est refusee ; idem pour
--      `template_id`.
--   4. `template_id` `on delete restrict` : un gabarit encore porte par un
--      document ne peut plus etre supprime (`document_pdf_template.in_use`),
--      branche laissee INATTEIGNABLE par 4a/4b faute de cette table —
--      ATTEIGNABLE a partir de ce lot.
--   5. `api_get_storefront_quote_document` : rend le document d un devis
--      `sent` du client de la session ; jeu de lignes VIDE (traduit en 404
--      INDISCERNABLE par la route) sur un devis `draft` (pas encore de
--      document), un devis d un AUTRE client, un devis d un AUTRE tenant, et
--      un devis SANS document — les quatre memes, aucune distinction.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_10b_4c_context (
  actor_admin_a  uuid not null,
  actor_member_a uuid not null,
  actor_admin_b  uuid not null,
  tenant_a       uuid not null,
  tenant_b       uuid not null,
  template_a     uuid not null,
  template_b     uuid not null,
  quote_a_sent   uuid not null,
  quote_a_draft  uuid not null,
  quote_a2_sent  uuid not null,
  quote_b_sent   uuid not null,
  document_a     uuid not null,
  token_a1       text not null
);

grant select on e10_10b_4c_context to authenticated, anon;

-- ── Prealables, joues en tant que postgres ─────────────────────────────────
do $$
declare
  v_actor_admin_a uuid := gen_random_uuid();
  v_actor_member_a uuid := gen_random_uuid();
  v_actor_admin_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_shop_a uuid;
  v_customer_a1 uuid;
  v_customer_a2 uuid;
  v_customer_b uuid;
  v_contact_a1 uuid;
  v_project_a1 uuid;
  v_project_a2 uuid;
  v_project_b uuid;
  v_template_a uuid;
  v_template_b uuid;
  v_quote_a_sent uuid;
  v_quote_a_draft uuid;
  v_quote_a2_sent uuid;
  v_quote_b_sent uuid;
  v_document_a uuid;
  v_account_a1 uuid;
  v_token_a1 text;
  v_pages jsonb := '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_admin_a, 'e10-10b-4c-admin-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_member_a, 'e10-10b-4c-member-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_admin_b, 'e10-10b-4c-admin-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-10b-4c-tenant-a', 'E10.10b-4c Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-10b-4c-tenant-b', 'E10.10b-4c Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin_a, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_member_a, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_admin_b, 'admin', 'magrit_full', '{}');

  insert into public.shops (owner_user_id, tenant_id, name, slug)
    values (v_actor_admin_a, v_tenant_a, 'E10.10b-4c Boutique A', 'e10-10b-4c-boutique-a') returning id into v_shop_a;

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.10b-4c Client A1', '73282932000074') returning id into v_customer_a1;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.10b-4c Client A2', '11111111100006') returning id into v_customer_a2;
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_b, 'company', 'E10.10b-4c Client B', '22222222200005') returning id into v_customer_b;

  insert into public.customer_contacts (customer_id, first_name, last_name, email)
    values (v_customer_a1, 'Contact', 'A1', 'contact.a1.e10-10b-4c@example.test') returning id into v_contact_a1;

  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a1, 'Projet A1') returning id into v_project_a1;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_a, v_customer_a2, 'Projet A2') returning id into v_project_a2;
  insert into public.projects (tenant_id, customer_id, name) values (v_tenant_b, v_customer_b, 'Projet B') returning id into v_project_b;

  -- Un gabarit READY dans CHAQUE tenant (phase privilegiee). `storage_path`
  -- pose en DEUX temps : la contrainte `document_pdf_templates_storage_path_canonical`
  -- exige `<tenant_id>/<id>.pdf`, or l id n est connu qu APRES l insertion.
  insert into public.document_pdf_templates (tenant_id, name, status, is_default, is_active, page_count, pages, byte_size, sha256)
    values (v_tenant_a, 'Gabarit A', 'ready', true, true, 1, v_pages, 1000, repeat('a', 64))
    returning id into v_template_a;
  update public.document_pdf_templates set storage_path = v_tenant_a::text || '/' || v_template_a::text || '.pdf' where id = v_template_a;

  insert into public.document_pdf_templates (tenant_id, name, status, is_default, is_active, page_count, pages, byte_size, sha256)
    values (v_tenant_b, 'Gabarit B', 'ready', true, true, 1, v_pages, 1000, repeat('b', 64))
    returning id into v_template_b;
  update public.document_pdf_templates set storage_path = v_tenant_b::text || '/' || v_template_b::text || '.pdf' where id = v_template_b;

  -- ── Devis : un envoye AVEC document (A1), un draft (A1, jamais de document),
  -- un envoye d un AUTRE client meme tenant (A2), un envoye d un AUTRE tenant (B).
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-91001', 'draft', null, true)
    returning id into v_quote_a_sent;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_a_sent, null, 'free', 'Flyers A5', 200, 0, 100.00, 200.00, 200.00, 1.0000, 190.00, 0.0500, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() - interval '1 day' where id = v_quote_a_sent;

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a1, v_project_a1, 'DEV-2026-91002', 'draft', null, true)
    returning id into v_quote_a_draft;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_a_draft, null, 'free', 'Ligne brouillon', 1, 0, 500.00, 1000.00, 1000.00, 1.0000, 1000.00, 0.0000, '[{"post":"total","cost":"500.00","margin_rate":"1.0000","price":"1000.00","source":"prix_marche"}]'::jsonb);
  -- reste 'draft' : aucun document ne peut exister pour ce devis.

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a2, v_project_a2, 'DEV-2026-91003', 'draft', null, true)
    returning id into v_quote_a2_sent;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_a2_sent, null, 'free', 'Devis client A2', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() where id = v_quote_a2_sent;

  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_b, v_customer_b, v_project_b, 'DEV-2026-91004', 'draft', null, true)
    returning id into v_quote_b_sent;
  insert into public.commercial_quote_lines (quote_id, project_item_id, origin, label, quantity, position, production_price, public_price, customer_price, applied_margin_rate, sale_price, discount_rate, breakdown)
    values (v_quote_b_sent, null, 'free', 'Devis tenant B', 1, 0, 100.00, 200.00, 200.00, 1.0000, 200.00, 0.0000, '[{"post":"total","cost":"100.00","margin_rate":"1.0000","price":"200.00","source":"prix_marche"}]'::jsonb);
  perform set_config('magrit.quote_transition', 'true', true);
  update public.commercial_quotes set status = 'sent', sent_at = now() where id = v_quote_b_sent;

  -- ── LE document (service_role uniquement, phase privilegiee ici) ─────────
  insert into public.quote_documents (tenant_id, quote_id, template_id, storage_path, byte_size, sha256, page_count, generated_at, generated_by)
    values (v_tenant_a, v_quote_a_sent, v_template_a, v_tenant_a::text || '/' || v_quote_a_sent::text || '.pdf', 12345, repeat('c', 64), 1, now() - interval '1 day', v_actor_admin_a)
    returning id into v_document_a;

  -- ── Compte boutique + session, pour le scenario storefront (5) ──────────
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at, customer_contact_id)
    values (v_shop_a, 'account.a1.e10-10b-4c@example.test', 'Compte A1', 'active', now(), v_contact_a1)
    returning id into v_account_a1;

  select encode(extensions.gen_random_bytes(32), 'hex') into v_token_a1;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
    values (v_account_a1, v_shop_a, extensions.digest(convert_to(v_token_a1, 'UTF8'), 'sha256'), now() + interval '1 hour');

  insert into e10_10b_4c_context (
    actor_admin_a, actor_member_a, actor_admin_b, tenant_a, tenant_b, template_a, template_b,
    quote_a_sent, quote_a_draft, quote_a2_sent, quote_b_sent, document_a, token_a1
  ) values (
    v_actor_admin_a, v_actor_member_a, v_actor_admin_b, v_tenant_a, v_tenant_b, v_template_a, v_template_b,
    v_quote_a_sent, v_quote_a_draft, v_quote_a2_sent, v_quote_b_sent, v_document_a, v_token_a1
  );
end;
$$;

-- ── 1. RLS lecture ATELIER ───────────────────────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin_b uuid;
  v_visible integer;
begin
  select tenant_a, actor_admin_b into v_tenant_a, v_actor_admin_b from e10_10b_4c_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_visible from public.quote_documents where tenant_id = v_tenant_a;
  reset role;

  if v_visible <> 0 then
    raise exception 'le tenant B lit % document(s) du tenant A — quote_documents_select rompue', v_visible;
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin_a uuid;
  v_visible integer;
begin
  select tenant_a, actor_admin_a into v_tenant_a, v_actor_admin_a from e10_10b_4c_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_visible from public.quote_documents where tenant_id = v_tenant_a;
  reset role;

  if v_visible <> 1 then
    raise exception 'un membre du tenant A ne lit pas son propre document (attendu 1, lu %)', v_visible;
  end if;
end;
$$;

-- ── 2. APPEND-ONLY, service_role UNIQUEMENT ─────────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_quote_a_draft uuid;
  v_actor_admin_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, template_a, quote_a_draft, actor_admin_a into v_tenant_a, v_template_a, v_quote_a_draft, v_actor_admin_a from e10_10b_4c_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.quote_documents (tenant_id, quote_id, template_id, storage_path, byte_size, sha256, page_count, generated_at)
      values (v_tenant_a, v_quote_a_draft, v_template_a, v_tenant_a::text || '/' || v_quote_a_draft::text || '.pdf', 100, repeat('d', 64), 1, now());
  exception
    when insufficient_privilege then v_rejected := true;
    when others then reset role; raise;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un admin (authenticated) a pu inserer un document en DIRECT — reserve au service_role (contrat §8.18 §2)';
  end if;
end;
$$;

do $$
declare
  v_document_a uuid;
  v_actor_admin_a uuid;
  v_rejected boolean := false;
begin
  select document_a, actor_admin_a into v_document_a, v_actor_admin_a from e10_10b_4c_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.quote_documents set byte_size = 1 where id = v_document_a;
  exception
    when insufficient_privilege then v_rejected := true;
    when others then reset role; raise;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un admin (authenticated) a pu MODIFIER un document en DIRECT — append-only (contrat §8.18 §2)';
  end if;
end;
$$;

do $$
declare
  v_document_a uuid;
  v_actor_admin_a uuid;
  v_rejected boolean := false;
begin
  select document_a, actor_admin_a into v_document_a, v_actor_admin_a from e10_10b_4c_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    delete from public.quote_documents where id = v_document_a;
  exception
    when insufficient_privilege then v_rejected := true;
    when others then reset role; raise;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un admin (authenticated) a pu SUPPRIMER un document en DIRECT — append-only (contrat §8.18 §2)';
  end if;
end;
$$;

-- ── 2bis. qa-review B1 (BLOQUANT, round 2) — INSERTION SOUS LE ROLE
-- REELEMENT UTILISE EN PRODUCTION. Le scenario 2 ci-dessus prouve que
-- `authenticated` est REFUSE ; celui-ci prouve le COMPLEMENT necessaire :
-- `service_role` (le role que `SupabaseQuoteDocumentsRepository.store()`
-- utilise reellement depuis la composition corrigee,
-- `supabase/functions/magrit-api/index.ts`) PEUT ecrire. Sans ce scenario,
-- une regression qui reintroduirait le bug B1 (passer le client
-- `authenticated` a l adaptateur) ne serait detectee que par la lecture du
-- code applicatif, jamais par ce fichier SQL.
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_quote_a_draft uuid;
  v_inserted integer;
begin
  select tenant_a, template_a, quote_a_draft into v_tenant_a, v_template_a, v_quote_a_draft from e10_10b_4c_context;

  set local role service_role;
  insert into public.quote_documents (tenant_id, quote_id, template_id, storage_path, byte_size, sha256, page_count, generated_at)
    values (v_tenant_a, v_quote_a_draft, v_template_a, v_tenant_a::text || '/' || v_quote_a_draft::text || '.pdf', 100, repeat('9', 64), 1, now());
  get diagnostics v_inserted = row_count;
  reset role;

  if v_inserted <> 1 then
    raise exception 'service_role n a pas pu inserer un document (attendu 1 ligne, % inseree(s)) — le chemin de production (SupabaseQuoteDocumentsRepository.store()) ne peut fonctionner sans cette capacite (qa-review B1)', v_inserted;
  end if;

  -- Pas de nettoyage manuel : service_role n a PAS le grant `delete` sur
  -- cette table (append-only, meme discipline que `outbox_events` — seuls
  -- `select`/`insert` lui sont accordes, migration 20260909040000). Le
  -- `rollback;` final de ce script efface cette ligne comme tout le reste du
  -- scenario.
end;
$$;

-- ── 3. Trigger de coherence tenant (defense en profondeur, meme patron 4b) ──
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_template_a uuid;
  v_quote_b_sent uuid;
  v_rejected boolean := false;
begin
  select tenant_a, tenant_b, template_a, quote_b_sent into v_tenant_a, v_tenant_b, v_template_a, v_quote_b_sent from e10_10b_4c_context;

  -- Insertion PRIVILEGIEE (postgres, hors RLS) avec quote_id du tenant B mais
  -- tenant_id = A : doit etre refusee par le trigger, PAS par la RLS.
  begin
    insert into public.quote_documents (tenant_id, quote_id, template_id, storage_path, byte_size, sha256, page_count, generated_at)
      values (v_tenant_a, v_quote_b_sent, v_template_a, v_tenant_a::text || '/' || v_quote_b_sent::text || '.pdf', 100, repeat('e', 64), 1, now());
  exception
    when others then v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'un document a pu etre insere avec un quote_id d un AUTRE tenant que tenant_id (trigger quote_documents_same_tenant rompu)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_template_b uuid;
  v_quote_a_draft uuid;
  v_rejected boolean := false;
begin
  select tenant_a, tenant_b, template_b, quote_a_draft into v_tenant_a, v_tenant_b, v_template_b, v_quote_a_draft from e10_10b_4c_context;

  begin
    insert into public.quote_documents (tenant_id, quote_id, template_id, storage_path, byte_size, sha256, page_count, generated_at)
      values (v_tenant_a, v_quote_a_draft, v_template_b, v_tenant_a::text || '/' || v_quote_a_draft::text || '.pdf', 100, repeat('f', 64), 1, now());
  exception
    when others then v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'un document a pu etre insere avec un template_id d un AUTRE tenant que tenant_id (trigger quote_documents_same_tenant rompu)';
  end if;
end;
$$;

-- ── 4. `template_id on delete restrict` — ATTEIGNABLE depuis ce lot ─────────
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_actor_admin_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a, template_a, actor_admin_a into v_tenant_a, v_template_a, v_actor_admin_a from e10_10b_4c_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_delete_document_pdf_template(v_tenant_a, v_template_a);
  exception
    when others then
      if sqlerrm like 'document_pdf_template.in_use%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un gabarit encore porte par un document a pu etre supprime (attendu document_pdf_template.in_use, branche ATTEIGNABLE depuis 4c)';
  end if;
end;
$$;

-- ── 5. api_get_storefront_quote_document ────────────────────────────────────
do $$
declare
  v_token_a1 text;
  v_quote_a_sent uuid;
  v_document_a uuid;
  v_row record;
  v_count integer;
begin
  select token_a1, quote_a_sent, document_a into v_token_a1, v_quote_a_sent, v_document_a from e10_10b_4c_context;

  set local role anon;
  select * into v_row from public.api_get_storefront_quote_document(v_token_a1, v_quote_a_sent);
  reset role;

  if v_row.quote_id is null or v_row.quote_id <> v_quote_a_sent then
    raise exception 'le client A1 ne recoit pas le document de SON devis envoye (attendu %, recu %)', v_quote_a_sent, v_row.quote_id;
  end if;
end;
$$;

do $$
declare
  v_token_a1 text;
  v_quote_a_draft uuid;
  v_count integer;
begin
  select token_a1, quote_a_draft into v_token_a1, v_quote_a_draft from e10_10b_4c_context;

  set local role anon;
  select count(*) into v_count from public.api_get_storefront_quote_document(v_token_a1, v_quote_a_draft);
  reset role;

  if v_count <> 0 then
    raise exception 'un devis DRAFT (jamais de document) a rendu % ligne(s) — attendu 0 (404 indiscernable)', v_count;
  end if;
end;
$$;

do $$
declare
  v_token_a1 text;
  v_quote_a2_sent uuid;
  v_count integer;
begin
  select token_a1, quote_a2_sent into v_token_a1, v_quote_a2_sent from e10_10b_4c_context;

  set local role anon;
  select count(*) into v_count from public.api_get_storefront_quote_document(v_token_a1, v_quote_a2_sent);
  reset role;

  if v_count <> 0 then
    raise exception 'le client A1 lit le document du devis d un AUTRE client (A2) — attendu 0 ligne (isolation client)';
  end if;
end;
$$;

do $$
declare
  v_token_a1 text;
  v_quote_b_sent uuid;
  v_count integer;
begin
  select token_a1, quote_b_sent into v_token_a1, v_quote_b_sent from e10_10b_4c_context;

  set local role anon;
  select count(*) into v_count from public.api_get_storefront_quote_document(v_token_a1, v_quote_b_sent);
  reset role;

  if v_count <> 0 then
    raise exception 'le client A1 (tenant A) lit un document d un devis du tenant B — isolation inter-tenant rompue';
  end if;
end;
$$;

do $$
declare
  v_count integer;
begin
  set local role anon;
  select count(*) into v_count from public.api_get_storefront_quote_document('jeton-invalide-trop-court', gen_random_uuid());
  reset role;

  if v_count <> 0 then
    raise exception 'un jeton de session invalide (forme incorrecte) a rendu % ligne(s) — attendu 0', v_count;
  end if;
end;
$$;

rollback;
