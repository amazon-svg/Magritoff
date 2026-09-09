-- ============================================================================
-- E10.10b-4b — editeur de coordonnees : table `document_pdf_template_fields`,
-- fonction `api_replace_document_pdf_template_fields`, RLS (isolation
-- inter-tenant + garde can_manage_document_templates EN BASE), et completion
-- D1 de `api_confirm_document_pdf_template_upload` (has_field_map = lines_block
-- OU au moins un placement). Migration : 20260909030000. Contrat :
-- docs/api/CONVENTIONS.md §8.18, openapi/magrit-core.v1.yaml
-- (GET/PUT /document-pdf-templates/{id}/fields).
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : le seed, la
-- fonction, la RLS vivent ENTIEREMENT dans la migration 20260909030000 — une
-- lecture de son texte ne prouve pas qu ils se comportent correctement sous
-- appel reel (meme lecon que E10.10b-4a).
--
-- Scenarios :
--   1. RLS lecture : un membre du tenant B ne voit AUCUN placement du tenant
--      A ; un membre SANS can_manage_document_templates voit NEANMOINS les
--      placements de SON PROPRE tenant (lecture ouverte a tout membre).
--   2. RLS ecriture DIRECTE (defense en profondeur, hors fonction) : un
--      membre SANS can_manage_document_templates ne peut pas inserer une
--      ligne de son propre tenant ; un admin (derivation) le peut.
--   3. api_replace_document_pdf_template_fields : refuse sans le droit ;
--      not_found hors tenant ; upload_required sur un gabarit
--      awaiting_upload ; REMPLACEMENT INTEGRAL (un champ absent du second
--      appel disparait) ; met a jour lines_block sur document_pdf_templates
--      DANS LA MEME transaction.
--   4. Contrainte EN BASE `document_pdf_template_fields_unique_field` : un
--      meme champ ne peut pas apparaitre deux fois pour un gabarit, y compris
--      par ecriture DIRECTE privilegiee (defense en profondeur au-dela de la
--      fonction).
--   5. D1 (§8.18 §9) — has_field_map COMPLETE : un gabarit portant SEULEMENT
--      des placements (aucun lines_block) rend has_field_map=TRUE, prouve
--      INDIRECTEMENT par le fait qu un changement de geometrie sur ce
--      gabarit est refuse (geometry_changed) sans reset_fields — la branche
--      qui teste has_field_map. reset_fields=true vide ALORS aussi les
--      placements (mise en conformite au contrat que 4a n avait pas pu
--      tenir faute de cette table, pas une extension du cru de 4b).
--   6. qa-review B1 (faille CONFIRMEE par execution reelle, CORRIGEE dans
--      cette meme migration) : un admin du tenant B tente un INSERT DIRECT
--      avec `template_id` = un gabarit du tenant A et `tenant_id` = B (la
--      policy `with check` ne verifiant que son PROPRE tenant_id, ce cas
--      passait la RLS avant correction) — DOIT etre refuse par le trigger
--      `document_pdf_template_fields_same_tenant`. Verifie aussi que
--      `has_field_map`, une fois le filtre `tenant_id` ajoute a son
--      `exists(...)`, ne compte plus une ligne d un AUTRE tenant meme
--      inseree en phase privilegiee (bypass du trigger et de la RLS).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_10b_4b_context (
  actor_admin  uuid not null,
  actor_member uuid not null,
  actor_b      uuid not null,
  tenant_a     uuid not null,
  tenant_b     uuid not null
);

grant select on e10_10b_4b_context to authenticated;

-- ── Prealables, joues en tant que postgres ─────────────────────────────────
do $$
declare
  v_actor_admin uuid := gen_random_uuid();
  v_actor_member uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_template_a uuid;
  v_template_b uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_admin, 'e10-10b-4b-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_member, 'e10-10b-4b-member@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-10b-4b-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-10b-4b-tenant-a', 'E10.10b-4b Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-10b-4b-tenant-b', 'E10.10b-4b Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_member, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  -- Un gabarit READY dans CHAQUE tenant (phase privilegiee), avec un
  -- placement chacun, pour le scenario de lecture inter-tenant (1).
  insert into public.document_pdf_templates (tenant_id, name, status, page_count, pages)
    values (v_tenant_a, 'Gabarit A', 'ready', 1, '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb)
    returning id into v_template_a;
  insert into public.document_pdf_templates (tenant_id, name, status, page_count, pages)
    values (v_tenant_b, 'Gabarit B', 'ready', 1, '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb)
    returning id into v_template_b;

  insert into public.document_pdf_template_fields
    (template_id, tenant_id, field, page_index, x, y, align, font, font_size, color)
  values
    (v_template_a, v_tenant_a, 'quote.number', 0, 50, 50, 'left', 'helvetica', 10, '#111111'),
    (v_template_b, v_tenant_b, 'quote.number', 0, 50, 50, 'left', 'helvetica', 10, '#111111');

  insert into e10_10b_4b_context (actor_admin, actor_member, actor_b, tenant_a, tenant_b)
  values (v_actor_admin, v_actor_member, v_actor_b, v_tenant_a, v_tenant_b);
end;
$$;

-- ── 1. RLS lecture ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_b::text from e10_10b_4b_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_visible integer;
begin
  select tenant_a into v_tenant_a from e10_10b_4b_context;
  select count(*) into v_visible from public.document_pdf_template_fields where tenant_id = v_tenant_a;
  if v_visible <> 0 then
    raise exception 'le tenant B lit % placement(s) du tenant A — document_pdf_template_fields_select rompue', v_visible;
  end if;
end;
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_member::text from e10_10b_4b_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_tenant_a uuid;
  v_visible integer;
begin
  select tenant_a into v_tenant_a from e10_10b_4b_context;
  select count(*) into v_visible from public.document_pdf_template_fields where tenant_id = v_tenant_a;
  if v_visible <> 1 then
    raise exception 'un membre SANS can_manage_document_templates ne lit pas les placements de son propre tenant (attendu 1, lu %)', v_visible;
  end if;
end;
$$;

reset role;

-- ── 2. RLS ecriture DIRECTE (defense en profondeur, hors fonction) ────────
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_actor_member uuid;
  v_inserted integer;
begin
  select tenant_a, actor_member into v_tenant_a, v_actor_member from e10_10b_4b_context;
  select id into v_template_a from public.document_pdf_templates where tenant_id = v_tenant_a and name = 'Gabarit A';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.document_pdf_template_fields
      (template_id, tenant_id, field, page_index, x, y, align, font, font_size, color)
    values (v_template_a, v_tenant_a, 'quote.issued_at', 0, 60, 60, 'left', 'helvetica', 10, '#111111');
    get diagnostics v_inserted = row_count;
  exception
    when insufficient_privilege then v_inserted := 0;
  end;
  reset role;

  if v_inserted <> 0 then
    raise exception 'un membre SANS can_manage_document_templates a pu inserer un placement en DIRECT (document_pdf_template_fields_write rompue)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_actor_admin uuid;
  v_inserted integer;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4b_context;
  select id into v_template_a from public.document_pdf_templates where tenant_id = v_tenant_a and name = 'Gabarit A';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.document_pdf_template_fields
    (template_id, tenant_id, field, page_index, x, y, align, font, font_size, color)
  values (v_template_a, v_tenant_a, 'quote.issued_at', 0, 60, 60, 'left', 'helvetica', 10, '#111111');
  get diagnostics v_inserted = row_count;
  reset role;

  if v_inserted <> 1 then
    raise exception 'un admin (derivation) n a pas pu inserer un placement en DIRECT (attendu 1 ligne, % inseree(s))', v_inserted;
  end if;

  delete from public.document_pdf_template_fields where template_id = v_template_a and field = 'quote.issued_at';
end;
$$;

-- ── 3. api_replace_document_pdf_template_fields ─────────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_actor_member uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_member into v_tenant_a, v_actor_member from e10_10b_4b_context;
  select id into v_template_a from public.document_pdf_templates where tenant_id = v_tenant_a and name = 'Gabarit A';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_replace_document_pdf_template_fields(v_tenant_a, v_template_a, '[]'::jsonb, null);
  exception
    when others then
      if sqlerrm like 'permission_denied%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'un membre SANS can_manage_document_templates a pu remplacer la carte (attendu permission_denied)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_not_found boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_replace_document_pdf_template_fields(v_tenant_a, gen_random_uuid(), '[]'::jsonb, null);
  exception
    when others then
      if sqlerrm like 'document_pdf_template.not_found%' then v_not_found := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_not_found then
    raise exception 'remplacement sur un gabarit inexistant accepte (attendu document_pdf_template.not_found)';
  end if;
end;
$$;

do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_awaiting_id uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_awaiting_id := (public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Gabarit non pret', false)).id;

  begin
    perform public.api_replace_document_pdf_template_fields(v_tenant_a, v_awaiting_id, '[]'::jsonb, null);
  exception
    when others then
      if sqlerrm like 'document_pdf_template.upload_required%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'remplacement accepte sur un gabarit awaiting_upload (attendu document_pdf_template.upload_required)';
  end if;
end;
$$;

-- REMPLACEMENT INTEGRAL : un second appel qui omet un champ du premier le
-- retire ; met a jour lines_block dans la MEME transaction.
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_actor_admin uuid;
  v_count integer;
  v_lines_block jsonb;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4b_context;
  select id into v_template_a from public.document_pdf_templates where tenant_id = v_tenant_a and name = 'Gabarit A';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  perform public.api_replace_document_pdf_template_fields(
    v_tenant_a, v_template_a,
    '[{"field":"quote.number","page_index":0,"x":50,"y":50,"max_lines":1,"align":"left","font":"helvetica","font_size":10,"color":"#111111"},
      {"field":"quote.issued_at","page_index":0,"x":100,"y":100,"max_lines":1,"align":"left","font":"helvetica","font_size":10,"color":"#111111"}]'::jsonb,
    '{"page_index":0,"first_row_baseline_y":700,"row_height":14,"rows_per_page":20,"continuation_page_index":null,"columns":[{"field":"line.label","x":50,"width":300,"align":"left","font":"helvetica","font_size":10,"color":"#111111"}]}'::jsonb
  );

  select count(*) into v_count from public.document_pdf_template_fields where template_id = v_template_a;
  if v_count <> 2 then
    raise exception 'premier remplacement : attendu 2 placements, trouve %', v_count;
  end if;

  -- Second appel : NE reprend QUE quote.number -> quote.issued_at doit disparaitre.
  perform public.api_replace_document_pdf_template_fields(
    v_tenant_a, v_template_a,
    '[{"field":"quote.number","page_index":0,"x":55,"y":55,"max_lines":1,"align":"left","font":"helvetica","font_size":10,"color":"#111111"}]'::jsonb,
    null
  );
  reset role;

  select count(*) into v_count from public.document_pdf_template_fields where template_id = v_template_a;
  if v_count <> 1 then
    raise exception 'second remplacement (integral) : attendu 1 placement restant, trouve %', v_count;
  end if;
  if exists (select 1 from public.document_pdf_template_fields where template_id = v_template_a and field = 'quote.issued_at') then
    raise exception 'second remplacement : quote.issued_at aurait du disparaitre (remplacement INTEGRAL, pas une fusion)';
  end if;

  select lines_block into v_lines_block from public.document_pdf_templates where id = v_template_a;
  if v_lines_block is not null then
    raise exception 'second remplacement : lines_block aurait du etre efface (passe null), trouve %', v_lines_block;
  end if;
end;
$$;

-- ── 4. Contrainte EN BASE unique(template_id, field) ────────────────────────
do $$
declare
  v_tenant_a uuid;
  v_template_a uuid;
  v_rejected boolean := false;
begin
  select tenant_a into v_tenant_a from e10_10b_4b_context;
  select id into v_template_a from public.document_pdf_templates where tenant_id = v_tenant_a and name = 'Gabarit A';

  -- Ecriture DIRECTE privilegiee (bypass RLS) : la contrainte UNIQUE ne
  -- depend d aucun role, contrairement a la RLS.
  begin
    insert into public.document_pdf_template_fields
      (template_id, tenant_id, field, page_index, x, y, align, font, font_size, color)
    values (v_template_a, v_tenant_a, 'quote.number', 0, 999, 999, 'left', 'helvetica', 10, '#111111');
  exception
    when unique_violation then v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'un meme champ (quote.number) a pu etre insere DEUX FOIS pour le meme gabarit (contrainte unique contournee)';
  end if;
end;
$$;

-- ── 5. D1 — has_field_map COMPLETE (placements SEULS, sans lines_block) ─────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_template_id uuid;
  v_rejected boolean := false;
  v_confirmed public.document_pdf_templates;
  v_remaining integer;
  v_pages_a4 jsonb := '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb;
  v_pages_letter jsonb := '[{"index":0,"width_pt":612,"height_pt":792}]'::jsonb;
begin
  select tenant_a, actor_admin into v_tenant_a, v_actor_admin from e10_10b_4b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_template_id := (public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Gabarit D1', false)).id;
  perform public.api_confirm_document_pdf_template_upload(
    v_tenant_a, v_template_id, 1, v_pages_a4, 1000, repeat('a', 64), false
  );

  -- Carte avec SEULEMENT un placement, AUCUN lines_block — le cas exact que
  -- 4a demandait de prouver (§8.18 §9).
  perform public.api_replace_document_pdf_template_fields(
    v_tenant_a, v_template_id,
    '[{"field":"quote.number","page_index":0,"x":50,"y":50,"max_lines":1,"align":"left","font":"helvetica","font_size":10,"color":"#111111"}]'::jsonb,
    null
  );

  -- has_field_map DOIT valoir true : un changement de geometrie SANS
  -- reset_fields doit donc etre REFUSE (geometry_changed), preuve indirecte
  -- mais univoque que le OR exists(...) fonctionne.
  begin
    perform public.api_confirm_document_pdf_template_upload(
      v_tenant_a, v_template_id, 1, v_pages_letter, 1000, repeat('b', 64), false
    );
  exception
    when others then
      if sqlerrm like 'document_pdf_template.geometry_changed%' then v_rejected := true; else reset role; raise; end if;
  end;

  if not v_rejected then
    reset role;
    raise exception 'un gabarit avec SEULEMENT des placements (aucun lines_block) n a pas ete traite comme has_field_map=true (D1 non complete)';
  end if;

  -- reset_fields=true : accepte, ET vide aussi les placements (decision 4b).
  v_confirmed := public.api_confirm_document_pdf_template_upload(
    v_tenant_a, v_template_id, 1, v_pages_letter, 1000, repeat('c', 64), true
  );
  reset role;

  if v_confirmed.pages <> v_pages_letter then
    raise exception 'reset_fields=true : la nouvelle geometrie n a pas ete enregistree';
  end if;

  select count(*) into v_remaining from public.document_pdf_template_fields where template_id = v_template_id;
  if v_remaining <> 0 then
    raise exception 'reset_fields=true : % placement(s) subsistent alors qu ils auraient du etre effaces (decision 4b)', v_remaining;
  end if;
end;
$$;

-- ── 6. qa-review B1 — isolation tenant sur template_id/tenant_id ────────────
-- 6a. Un admin du tenant B, en connaissant l UUID d un gabarit du tenant A,
-- tente un INSERT DIRECT avec template_id = ce gabarit (A) et tenant_id = B.
-- AVANT correction, la policy `with check` de `document_pdf_template_fields_write`
-- ne verifiait QUE `tenant_id = B` (colonne de la ligne elle-meme, jamais le
-- tenant REEL du gabarit designe) : ce cas PASSAIT la RLS. Doit maintenant
-- etre refuse par le trigger `document_pdf_template_fields_same_tenant`,
-- qui verifie explicitement `document_pdf_templates.tenant_id` du gabarit
-- CIBLE.
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_template_a uuid;
  v_actor_b uuid;
  v_rejected boolean := false;
begin
  select tenant_a, tenant_b, actor_b into v_tenant_a, v_tenant_b, v_actor_b from e10_10b_4b_context;
  select id into v_template_a from public.document_pdf_templates where tenant_id = v_tenant_a and name = 'Gabarit A';

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.document_pdf_template_fields
      (template_id, tenant_id, field, page_index, x, y, align, font, font_size, color)
    values (v_template_a, v_tenant_b, 'quote.customer_reference', 0, 10, 10, 'left', 'helvetica', 10, '#111111');
  exception
    when others then v_rejected := true;
  end;
  reset role;

  if not v_rejected then
    raise exception
      'B1 NON CORRIGEE : un admin du tenant B a pu inserer un placement avec template_id = gabarit du tenant A et tenant_id = B (isolation rompue)';
  end if;

  -- Aucun residu ne doit exister sous ce nom, quel que soit le tenant lu (la
  -- transaction du INSERT refuse a du etre integralement annulee).
  if exists (
    select 1 from public.document_pdf_template_fields
     where template_id = v_template_a and field = 'quote.customer_reference'
  ) then
    raise exception 'B1 : un residu du placement refuse a ete persiste malgre l exception';
  end if;
end;
$$;

-- 6b. Defense en profondeur redondante sur `has_field_map` (qa-review B1,
-- point b) : meme si le trigger du point 6a etait un jour desactive ou
-- contourne (ecriture privilegiee directe, hors RLS ET hors trigger — les
-- deux sont desactives explicitement ici pour forcer artificiellement l etat
-- incoherent), le filtre `and tenant_id = v_current.tenant_id` ajoute a
-- `has_field_map` empeche qu une ligne d un AUTRE tenant fasse basculer
-- has_field_map a true pour un gabarit qui n a reellement AUCUN placement a
-- lui.
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_actor_admin uuid;
  v_template_id uuid;
  v_confirmed public.document_pdf_templates;
  v_pages_a4 jsonb := '[{"index":0,"width_pt":595.28,"height_pt":841.89}]'::jsonb;
  v_pages_letter jsonb := '[{"index":0,"width_pt":612,"height_pt":792}]'::jsonb;
begin
  select tenant_a, tenant_b, actor_admin into v_tenant_a, v_tenant_b, v_actor_admin from e10_10b_4b_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_template_id := (public.api_create_document_pdf_template(v_tenant_a, 'quote', 'Gabarit D1 isolation', false)).id;
  perform public.api_confirm_document_pdf_template_upload(
    v_tenant_a, v_template_id, 1, v_pages_a4, 1000, repeat('f', 64), false
  );
  reset role;

  -- Force artificiellement la ligne incoherente que le trigger interdit
  -- desormais en fonctionnement normal (phase privilegiee, trigger
  -- explicitement desactive pour ce seul INSERT).
  alter table public.document_pdf_template_fields disable trigger document_pdf_template_fields_same_tenant;
  insert into public.document_pdf_template_fields
    (template_id, tenant_id, field, page_index, x, y, align, font, font_size, color)
  values (v_template_id, v_tenant_b, 'quote.number', 0, 10, 10, 'left', 'helvetica', 10, '#111111');
  alter table public.document_pdf_template_fields enable trigger document_pdf_template_fields_same_tenant;

  -- Un changement de geometrie sur v_template_id doit rester ACCEPTE SANS
  -- reset_fields : has_field_map doit valoir FALSE pour ce gabarit (le seul
  -- placement existant appartient a un AUTRE tenant, filtre par le exists()
  -- corrige).
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_confirmed := public.api_confirm_document_pdf_template_upload(
    v_tenant_a, v_template_id, 1, v_pages_letter, 1000, repeat('1', 64), false
  );
  reset role;

  if v_confirmed.pages <> v_pages_letter then
    raise exception
      'has_field_map (B1 point b) : un placement d un AUTRE tenant a fait refuser un changement de geometrie (geometry_changed) sur un gabarit qui n a reellement AUCUN placement a lui — le filtre tenant_id du exists() ne fonctionne pas';
  end if;

  delete from public.document_pdf_template_fields where template_id = v_template_id;
end;
$$;

rollback;
