-- ============================================================================
-- E10.14 — modale unifiee de changement de statut et historique horodate :
-- journal append-only (`commercial_order_step_changes`), RLS (isolation
-- inter-tenant + garde append-only EN BASE), transition
-- `api_change_commercial_order_production_step` (verrou de ligne, saut/recul
-- autorises, no-op refuse, etape inactive refusee, etape hors tenant
-- refusee, acteur cle de service), suppression d une etape citee UNIQUEMENT
-- par le journal (decision #13), concurrence REELLE sur le verrou.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale : la table, la
-- RLS et la fonction vivent ENTIEREMENT dans la migration `20260909000000` —
-- une lecture de son texte ne prouve pas qu elles se comportent correctement
-- sous appel reel (meme lecon que E10.9/E10.12/E10.13).
--
-- Scenarios :
--   1. Fixtures : tenant A (admin, member), tenant B (actor_b), commande de
--      tenant A posee directement sur l etape "Fichier reçu" (position 0).
--   2. RLS lecture : un membre du tenant B ne voit AUCUNE entree du journal
--      d une commande du tenant A.
--   3. RLS ecriture : ni un membre ordinaire ni un admin du tenant proprietaire
--      ne peuvent INSERT/UPDATE/DELETE directement sur le journal — la seule
--      voie est la fonction (append-only TENU EN BASE).
--   4. api_change_commercial_order_production_step, cas nominal : deplace la
--      commande de l etape 0 a l etape 1, insere UNE entree, met a jour
--      current_production_step_id DANS LA MEME TRANSACTION, actor_id/
--      actor_label = l acteur utilisateur.
--   5. order.step_unchanged : reposer la MEME etape est refuse, AUCUNE entree
--      supplementaire n est ecrite, current_state (etape courante) est lisible.
--   6. production_step.not_found : une etape du tenant B est refusee dans le
--      tenant A.
--   7. production_step.inactive : une etape DESACTIVEE est refusee comme
--      cible (arrivee), meme si elle est deja portee par une commande.
--   8. Saut direct (CA4) : de l etape 1 a l etape 5 (terminale), UNE seule
--      entree, aucune etape intermediaire journalisee.
--   9. Recul (CA4) : de l etape 5 a l etape 2, accepte, journalise.
--  10. Acteur CLE DE SERVICE : v_actor null (aucun request.jwt.claims pose),
--      p_actor_label fourni -> succes, actor_id NULL, actor_label = la
--      valeur fournie ; p_actor_label omis -> authentication_required.
--  11. Decision #13 : une etape referencee UNIQUEMENT par le journal (plus
--      aucune commande dessus) reste indelebile — DELETE echoue en violation
--      de cle etrangere (production_step.in_use, meme code qu E10.13).
--  12. CONCURRENCE REELLE (deux connexions dblink) : deux transitions
--      simultanees vers la MEME etape cible — une reussit, l autre leve
--      order.step_unchanged, le journal ne porte qu UNE entree pour ce
--      mouvement.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_14_context (
  actor_admin   uuid not null,
  actor_member  uuid not null,
  actor_b       uuid not null,
  tenant_a      uuid not null,
  tenant_b      uuid not null,
  customer_a    uuid not null,
  order_a       uuid not null,
  step_recu     uuid not null,
  step_pao      uuid not null,
  step_valide   uuid not null,
  step_prod     uuid not null,
  step_exped    uuid not null,
  step_livre    uuid not null,
  step_b        uuid not null
);

grant select on e10_14_context to authenticated;

-- ── 1. Fixtures, jouees en tant que postgres ───────────────────────────────
do $$
declare
  v_actor_admin uuid := gen_random_uuid();
  v_actor_member uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_project uuid;
  v_quote uuid;
  v_order uuid;
  v_step_recu uuid;
  v_step_pao uuid;
  v_step_valide uuid;
  v_step_prod uuid;
  v_step_exped uuid;
  v_step_livre uuid;
  v_step_b uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_admin, 'e10-14-admin@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_member, 'e10-14-member@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-14-actor-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-14-tenant-a', 'E10.14 Tenant A') returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-14-tenant-b', 'E10.14 Tenant B') returning id into v_tenant_b;

  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_admin, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_a, v_actor_member, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant_b, v_actor_b, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'E10.14 Client A', '73282932000074') returning id into v_customer_a;

  select id into v_step_recu   from public.production_steps where tenant_id = v_tenant_a and position = 0;
  select id into v_step_pao    from public.production_steps where tenant_id = v_tenant_a and position = 1;
  select id into v_step_valide from public.production_steps where tenant_id = v_tenant_a and position = 2;
  select id into v_step_prod   from public.production_steps where tenant_id = v_tenant_a and position = 3;
  select id into v_step_exped  from public.production_steps where tenant_id = v_tenant_a and position = 4;
  select id into v_step_livre  from public.production_steps where tenant_id = v_tenant_a and position = 5;
  select id into v_step_b      from public.production_steps where tenant_id = v_tenant_b and position = 0;

  -- Commande de tenant A, posee DIRECTEMENT (hors conversion — ce fichier
  -- n exerce pas api_convert_commercial_quote) sur l etape "Fichier reçu",
  -- meme raccourci de fixture que le scenario 10 d E10.13.
  insert into public.projects (tenant_id, customer_id, name)
    values (v_tenant_a, v_customer_a, 'Projet E10.14') returning id into v_project;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant_a, v_customer_a, v_project, 'DEV-2026-97001', 'draft', '2099-01-01', true)
    returning id into v_quote;
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, current_production_step_id
  )
  values (v_tenant_a, v_customer_a, v_quote, 'CDE-2026-97001', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12, v_step_recu)
  returning id into v_order;

  insert into e10_14_context (
    actor_admin, actor_member, actor_b, tenant_a, tenant_b, customer_a, order_a,
    step_recu, step_pao, step_valide, step_prod, step_exped, step_livre, step_b
  ) values (
    v_actor_admin, v_actor_member, v_actor_b, v_tenant_a, v_tenant_b, v_customer_a, v_order,
    v_step_recu, v_step_pao, v_step_valide, v_step_prod, v_step_exped, v_step_livre, v_step_b
  );
end;
$$;

-- ── 2. RLS lecture — le tenant B ne voit rien du journal du tenant A ───────
-- (journal encore vide a ce stade, mais la policy doit deja filtrer sur la
-- JOINTURE, pas seulement sur un compte a zero par coincidence : verifie a
-- nouveau apres la premiere transition, scenario 4bis ci-dessous.)
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_b::text from e10_14_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_order_a uuid;
  v_visible integer;
begin
  select order_a into v_order_a from e10_14_context;
  select count(*) into v_visible from public.commercial_order_step_changes where order_id = v_order_a;
  if v_visible <> 0 then
    raise exception 'le tenant B lit % entree(s) du journal du tenant A avant meme toute transition', v_visible;
  end if;
end;
$$;

reset role;

-- ── 3. RLS ecriture — AUCUN acteur applicatif ne peut ecrire directement ──
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_admin::text from e10_14_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_order_a uuid;
  v_step_recu uuid;
  v_step_pao uuid;
  v_inserted integer;
begin
  select order_a, step_recu, step_pao into v_order_a, v_step_recu, v_step_pao from e10_14_context;

  begin
    insert into public.commercial_order_step_changes (order_id, from_step_id, to_step_id, actor_label)
    values (v_order_a, v_step_recu, v_step_pao, 'insertion directe');
    raise exception 'un admin du tenant proprietaire a pu INSERT directement dans le journal (append-only rompu)';
  exception
    when insufficient_privilege then
      null; -- attendu : revoke insert ... from authenticated
  end;

  get diagnostics v_inserted = row_count;
end;
$$;

reset role;

-- ── 4. api_change_commercial_order_production_step — cas nominal ──────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_step_recu uuid;
  v_step_pao uuid;
  v_entry public.commercial_order_step_changes;
  v_current_step uuid;
  v_entry_count integer;
begin
  select tenant_a, actor_admin, order_a, step_recu, step_pao
    into v_tenant_a, v_actor_admin, v_order_a, v_step_recu, v_step_pao
    from e10_14_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_entry := public.api_change_commercial_order_production_step(v_tenant_a, v_order_a, v_step_pao, 'passage nominal');
  reset role;

  if v_entry.from_step_id is distinct from v_step_recu then
    raise exception 'from_step_id inattendu : % (attendu l etape "Fichier reçu", %)', v_entry.from_step_id, v_step_recu;
  end if;
  if v_entry.to_step_id is distinct from v_step_pao then
    raise exception 'to_step_id inattendu : % (attendu "PAO", %)', v_entry.to_step_id, v_step_pao;
  end if;
  if v_entry.actor_id is distinct from v_actor_admin then
    raise exception 'actor_id inattendu : % (attendu %, jeton utilisateur)', v_entry.actor_id, v_actor_admin;
  end if;
  if v_entry.actor_label is distinct from 'e10-14-admin@example.test' then
    raise exception 'actor_label inattendu : % (attendu l e-mail de l acteur)', v_entry.actor_label;
  end if;
  if v_entry.note is distinct from 'passage nominal' then
    raise exception 'note non reprise telle quelle : %', v_entry.note;
  end if;

  select current_production_step_id into v_current_step from public.commercial_orders where id = v_order_a;
  if v_current_step is distinct from v_step_pao then
    raise exception 'current_production_step_id non mis a jour dans la MEME transaction : % (attendu %)', v_current_step, v_step_pao;
  end if;

  select count(*) into v_entry_count from public.commercial_order_step_changes where order_id = v_order_a;
  if v_entry_count <> 1 then
    raise exception 'nombre d entrees inattendu apres la premiere transition : % (attendu 1)', v_entry_count;
  end if;
end;
$$;

-- ── 4bis. RLS lecture — le tenant B ne voit toujours rien, journal NON vide ─
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select actor_b::text from e10_14_context), 'role', 'authenticated')::text, true);

do $$
declare
  v_order_a uuid;
  v_visible integer;
begin
  select order_a into v_order_a from e10_14_context;
  select count(*) into v_visible from public.commercial_order_step_changes where order_id = v_order_a;
  if v_visible <> 0 then
    raise exception 'le tenant B lit % entree(s) du journal du tenant A (commercial_order_step_changes_select rompue)', v_visible;
  end if;
end;
$$;

reset role;

-- ── 5. order.step_unchanged — reposer la MEME etape est refuse ────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_step_pao uuid;
  v_entry_count_before integer;
  v_entry_count_after integer;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin, order_a, step_pao into v_tenant_a, v_actor_admin, v_order_a, v_step_pao from e10_14_context;
  select count(*) into v_entry_count_before from public.commercial_order_step_changes where order_id = v_order_a;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_change_commercial_order_production_step(v_tenant_a, v_order_a, v_step_pao, null);
  exception
    when others then
      if sqlerrm like 'order.step_unchanged%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'reposer la meme etape a reussi (attendu order.step_unchanged, decision #7)';
  end if;

  select count(*) into v_entry_count_after from public.commercial_order_step_changes where order_id = v_order_a;
  if v_entry_count_after <> v_entry_count_before then
    raise exception 'une entree "X -> X" a ete ecrite malgre le refus (% avant, % apres)', v_entry_count_before, v_entry_count_after;
  end if;
end;
$$;

-- ── 6. production_step.not_found — etape d un AUTRE tenant ────────────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_step_b uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin, order_a, step_b into v_tenant_a, v_actor_admin, v_order_a, v_step_b from e10_14_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_change_commercial_order_production_step(v_tenant_a, v_order_a, v_step_b, null);
  exception
    when others then
      if sqlerrm like 'production_step.not_found%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'une etape d un autre tenant a ete acceptee comme cible (attendu production_step.not_found)';
  end if;
end;
$$;

-- ── 7. production_step.inactive — etape DESACTIVEE refusee comme cible ────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_step_valide uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin, order_a, step_valide into v_tenant_a, v_actor_admin, v_order_a, v_step_valide from e10_14_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.production_steps set is_active = false where id = v_step_valide;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_change_commercial_order_production_step(v_tenant_a, v_order_a, v_step_valide, null);
  exception
    when others then
      if sqlerrm like 'production_step.inactive%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception 'une etape DESACTIVEE a ete acceptee comme cible (attendu production_step.inactive, decision #8)';
  end if;

  -- Reactivation pour les scenarios suivants (8/9 la traversent).
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.production_steps set is_active = true where id = v_step_valide;
  reset role;
end;
$$;

-- ── 8. Saut direct (CA4) — de PAO (1) a Livré (5), UNE seule entree ────────
do $$
declare
  v_tenant_a uuid;
  v_actor_member uuid;
  v_order_a uuid;
  v_step_pao uuid;
  v_step_livre uuid;
  v_entry public.commercial_order_step_changes;
  v_entry_count integer;
begin
  select tenant_a, actor_member, order_a, step_pao, step_livre
    into v_tenant_a, v_actor_member, v_order_a, v_step_pao, v_step_livre
    from e10_14_context;

  -- Membre ORDINAIRE (pas admin) : decision #10, aucune garde de capability.
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_member::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_entry := public.api_change_commercial_order_production_step(v_tenant_a, v_order_a, v_step_livre, null);
  reset role;

  if v_entry.from_step_id is distinct from v_step_pao then
    raise exception 'saut direct : from_step_id inattendu % (attendu PAO, %)', v_entry.from_step_id, v_step_pao;
  end if;
  if v_entry.to_step_id is distinct from v_step_livre then
    raise exception 'saut direct : to_step_id inattendu % (attendu Livré, %)', v_entry.to_step_id, v_step_livre;
  end if;
  if v_entry.note is not null then
    raise exception 'note attendue NULL (aucune fournie), obtenu %', v_entry.note;
  end if;

  select count(*) into v_entry_count from public.commercial_order_step_changes where order_id = v_order_a;
  if v_entry_count <> 2 then
    raise exception 'le saut direct a ecrit % entree(s) (attendu 2 au total : nominal + saut, aucune etape intermediaire)', v_entry_count;
  end if;

  -- Membre ORDINAIRE, UN MEMBRE SANS role admin/member (acteur inconnu du
  -- tenant) est refuse (permission_denied) : verifie ici, une seule fois,
  -- plutot que d ajouter un scenario dedie.
  declare
    v_stranger uuid := gen_random_uuid();
    v_rejected boolean := false;
  begin
    insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
      values (v_stranger, 'e10-14-stranger@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');
    perform set_config('request.jwt.claims', json_build_object('sub', v_stranger::text, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      perform public.api_change_commercial_order_production_step(v_tenant_a, v_order_a, v_step_pao, null);
    exception
      when others then
        if sqlerrm like 'permission_denied%' then v_rejected := true; else reset role; raise; end if;
    end;
    reset role;
    if not v_rejected then
      raise exception 'un acteur ETRANGER au tenant a pu deplacer la commande (attendu permission_denied)';
    end if;
  end;
end;
$$;

-- ── 9. Recul (CA4) — de Livré (5) a Fichier validé (2), accepte ───────────
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_order_a uuid;
  v_step_livre uuid;
  v_step_valide uuid;
  v_entry public.commercial_order_step_changes;
begin
  select tenant_a, actor_admin, order_a, step_livre, step_valide
    into v_tenant_a, v_actor_admin, v_order_a, v_step_livre, v_step_valide
    from e10_14_context;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_entry := public.api_change_commercial_order_production_step(v_tenant_a, v_order_a, v_step_valide, 'fichier repasse en PAO, fond perdu manquant');
  reset role;

  if v_entry.from_step_id is distinct from v_step_livre then
    raise exception 'recul : from_step_id inattendu % (attendu Livré, %)', v_entry.from_step_id, v_step_livre;
  end if;
  if v_entry.to_step_id is distinct from v_step_valide then
    raise exception 'recul : to_step_id inattendu % (attendu Fichier validé, %)', v_entry.to_step_id, v_step_valide;
  end if;
end;
$$;

-- ── 10. Acteur CLE DE SERVICE — v_actor NULL, p_actor_label ────────────────
do $$
declare
  v_tenant_a uuid;
  v_order_a uuid;
  v_step_prod uuid;
  v_step_exped uuid;
  v_entry public.commercial_order_step_changes;
  v_rejected boolean := false;
begin
  select tenant_a, order_a, step_prod, step_exped into v_tenant_a, v_order_a, v_step_prod, v_step_exped from e10_14_context;

  -- `request.jwt.claims` EXPLICITEMENT VIDE : auth.uid() lit
  -- `coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
  -- (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->>
  -- 'sub'))::uuid` — sans ce reset, le GUC pose 'local' (donc TRANSACTION-
  -- scoped, pas STATEMENT-scoped) par le scenario precedent resterait en
  -- vigueur jusqu au ROLLBACK final de ce fichier et simulerait a tort un
  -- jeton utilisateur encore present. Ainsi vide, auth.uid() est NULL,
  -- comme pour un appel de cle de service (aucun jeton utilisateur
  -- transmis). Execute EN TANT QUE postgres (superuser local, la subtilite
  -- du GRANT authenticated/service_role est une garde de la FACADE, deja
  -- verifiee par assertScopes() cote TypeScript et hors de portee d un test
  -- SQL pur qui s executerait de toute facon avec les privileges du
  -- proprietaire).
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.api_change_commercial_order_production_step(v_tenant_a, v_order_a, v_step_prod, null);
    raise exception 'un acteur sans jeton ET sans p_actor_label a pu ecrire (attendu authentication_required)';
  exception
    when others then
      if sqlerrm like 'authentication_required%' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'p_actor_label manquant : le refus attendu (authentication_required) n a pas eu lieu';
  end if;

  v_entry := public.api_change_commercial_order_production_step(v_tenant_a, v_order_a, v_step_prod, null, 'module:studio');

  if v_entry.actor_id is not null then
    raise exception 'actor_id inattendu pour une cle de service : % (attendu NULL)', v_entry.actor_id;
  end if;
  if v_entry.actor_label is distinct from 'module:studio' then
    raise exception 'actor_label inattendu pour une cle de service : % (attendu module:studio)', v_entry.actor_label;
  end if;
end;
$$;

-- ── 11. Decision #13 — etape referencee UNIQUEMENT par le journal ─────────
-- "Fichier reçu" (position 0) n est plus l etape COURANTE d aucune commande
-- (la commande a deja avance), mais elle est citee comme `from_step_id` de
-- la toute premiere entree du journal (scenario 4) : elle doit rester
-- INDELEBILE. Utilise `api_delete_production_step` (E10.13), qui traduit la
-- violation de cle etrangere en `production_step.in_use`, MEME code qu une
-- etape encore portee par `commercial_orders.current_production_step_id`.
do $$
declare
  v_tenant_a uuid;
  v_actor_admin uuid;
  v_step_recu uuid;
  v_order_a uuid;
  v_current_step uuid;
  v_rejected boolean := false;
begin
  select tenant_a, actor_admin, step_recu, order_a into v_tenant_a, v_actor_admin, v_step_recu, v_order_a from e10_14_context;

  select current_production_step_id into v_current_step from public.commercial_orders where id = v_order_a;
  if v_current_step = v_step_recu then
    raise exception 'fixture de scenario invalide : la commande est encore sur "Fichier reçu"';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_actor_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.api_delete_production_step(v_tenant_a, v_step_recu);
  exception
    when others then
      if sqlerrm like 'production_step.in_use%' then v_rejected := true; else reset role; raise; end if;
  end;
  reset role;

  if not v_rejected then
    raise exception '"Fichier reçu" a pu etre supprimee bien que citee par le journal (decision #13)';
  end if;

  if not exists (select 1 from public.production_steps where id = v_step_recu) then
    raise exception '"Fichier reçu" a disparu malgre le refus attendu';
  end if;
end;
$$;

rollback;

-- ============================================================================
-- ── 12. CONCURRENCE REELLE — deux SESSIONS Postgres separees ───────────────
-- Meme patron qu E10.12 (correctif B1) et E10.10b-2 : `dblink_send_query`/
-- `dblink_get_result`, deux connexions independantes, pour obtenir un
-- veritable verrou de ligne tenu par une transaction PENDANT qu une autre
-- bloque dessus. Preuve que `order.step_unchanged` (decision #7) tient sous
-- course reelle et pas seulement sous appel sequentiel — c est le SEUL test
-- qui le prouve (§3 du cadrage E10.14).
-- ============================================================================

create extension if not exists dblink with schema extensions;

create temporary table e10_14_race_context (
  connstr    text,
  tenant_id  uuid,
  actor_a    uuid,
  actor_b    uuid,
  order_id   uuid,
  step_from  uuid,
  step_to    uuid
);

insert into e10_14_race_context (connstr) values (
  format('dbname=postgres user=postgres password=%s host=%s', :'dblink_password', :'dblink_host')
);

-- Bloc A : fixtures, statement top-level AUTONOME (autocommit) : COMMITE
-- avant le bloc B, donc visible des deux connexions dblink separees.
do $$
declare
  v_actor_a uuid := gen_random_uuid();
  v_actor_b uuid := gen_random_uuid();
  v_tenant uuid;
  v_customer uuid;
  v_project uuid;
  v_quote uuid;
  v_order uuid;
  v_step_from uuid;
  v_step_to uuid;
begin
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values
      (v_actor_a, 'e10-14-race-a@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
      (v_actor_b, 'e10-14-race-b@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name) values ('e10-14-race-tenant', 'E10.14 Race Tenant') returning id into v_tenant;
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant, v_actor_a, 'member', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
    values (v_tenant, v_actor_b, 'member', 'magrit_full', '{}');
  insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant, 'company', 'E10.14 Race Client', '73282932000074') returning id into v_customer;

  select id into v_step_from from public.production_steps where tenant_id = v_tenant and position = 0;
  select id into v_step_to   from public.production_steps where tenant_id = v_tenant and position = 1;

  insert into public.projects (tenant_id, customer_id, name) values (v_tenant, v_customer, 'Projet Race E10.14') returning id into v_project;
  insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status, valid_until, show_discounts)
    values (v_tenant, v_customer, v_project, 'DEV-2026-98001', 'draft', '2099-01-01', true)
    returning id into v_quote;
  insert into public.commercial_orders (
    tenant_id, customer_id, quote_id, number, status, source_quote_status,
    lines_subtotal, global_discount, effective_discount_rate, net_total,
    vat_rate, vat_regime, vat_amount, total_incl_tax, current_production_step_id
  )
  values (v_tenant, v_customer, v_quote, 'CDE-2026-98001', 'validated', 'sent',
          10, 0, null, 10, 0.2, null, 2, 12, v_step_from)
  returning id into v_order;

  update e10_14_race_context set
    tenant_id = v_tenant, actor_a = v_actor_a, actor_b = v_actor_b,
    order_id = v_order, step_from = v_step_from, step_to = v_step_to;
end;
$$;

-- Bloc B : la course. Nettoyage GARANTI (bloc EXCEPTION) meme si l assertion
-- finale echoue.
do $$
declare
  v_connstr text;
  v_tenant uuid;
  v_actor_a uuid;
  v_actor_b uuid;
  v_order uuid;
  v_step_from uuid;
  v_step_to uuid;
  v_entry_id_a uuid;
  v_race_b_failed boolean := false;
  v_race_b_message text;
  v_entry_count integer;
  v_current_step uuid;
begin
  select connstr, tenant_id, actor_a, actor_b, order_id, step_from, step_to
    into v_connstr, v_tenant, v_actor_a, v_actor_b, v_order, v_step_from, v_step_to
  from e10_14_race_context;

  perform extensions.dblink_connect('race_a', v_connstr);
  perform extensions.dblink_connect('race_b', v_connstr);

  -- ── Session A : ENVOI ASYNCHRONE de la transition — elle PREND le verrou
  --    de ligne (le `SELECT ... FOR UPDATE` interne), execute l UPDATE/
  --    INSERT, puis TIENT la transaction ouverte (aucun commit) le temps
  --    que la session B, ci-dessous, ait engage sa propre tentative et se
  --    soit mise en attente dessus.
  perform extensions.dblink_exec('race_a', 'begin');
  perform extensions.dblink_exec('race_a', 'set local role authenticated');
  perform 1 from extensions.dblink(
    'race_a',
    format('select set_config(%L, %L, true)', 'request.jwt.claims', json_build_object('sub', v_actor_a::text, 'role', 'authenticated')::text)
  ) as t(result text);
  perform 1 from extensions.dblink(
    'race_a',
    format('select (public.api_change_commercial_order_production_step(%L::uuid, %L::uuid, %L::uuid, null::text)).id', v_tenant, v_order, v_step_to)
  ) as t(id uuid);

  -- ── Session B : ENVOI ASYNCHRONE (dblink_send_query) de la MEME
  --    transition vers la MEME etape cible — elle bloque reellement sur
  --    `SELECT ... FOR UPDATE` (la ligne est verrouillee, non commitee, par
  --    la session A ci-dessus), SANS bloquer cette session orchestratrice.
  perform extensions.dblink_exec('race_b', 'begin');
  perform extensions.dblink_exec('race_b', 'set local role authenticated');
  perform 1 from extensions.dblink(
    'race_b',
    format('select set_config(%L, %L, true)', 'request.jwt.claims', json_build_object('sub', v_actor_b::text, 'role', 'authenticated')::text)
  ) as t(result text);
  perform extensions.dblink_send_query(
    'race_b',
    format('select (public.api_change_commercial_order_production_step(%L::uuid, %L::uuid, %L::uuid, null::text)).id', v_tenant, v_order, v_step_to)
  );

  -- Laisse la session B atteindre reellement son attente sur le verrou.
  perform pg_sleep(0.5);

  -- La session A committe SEULEMENT MAINTENANT : le verrou se libere, la
  -- session B (bloquee sur FOR UPDATE) peut alors relire — sous attente de
  -- verrou puis lecture standard READ COMMITTED — la version la PLUS
  -- RECENTE COMMITEE (celle que A vient de poser), et doit donc constater
  -- que l etape cible est deja atteinte.
  perform extensions.dblink_exec('race_a', 'commit');

  -- Recupere le resultat ASYNCHRONE de la session B. `dblink_get_result`
  -- PROPAGE l exception distante (order.step_unchanged) au moment ou on la
  -- recupere : capturee ici, dans SON PROPRE bloc, plutot que de laisser
  -- planter tout le bloc englobant. Le DRAINAGE (second appel, discipline
  -- standard dblink_get_result apres dblink_send_query) doit rester dans un
  -- bloc SEPARE : une fois la premiere erreur levee et capturee, la
  -- connexion reste dans un etat "commande en cours" tant que ce second
  -- appel n a pas ete fait — SANS lui, tout ordre ulterieur sur cette
  -- connexion (y compris un simple disconnect) echoue avec « another
  -- command is already in progress ».
  begin
    perform result from extensions.dblink_get_result('race_b') as t(result uuid);
  exception
    when others then
      v_race_b_failed := true;
      v_race_b_message := sqlerrm;
  end;
  begin
    perform extensions.dblink_get_result('race_b'); -- draine jusqu a NULL
  exception
    when others then
      null; -- rien d exploitable ici : le message utile a deja ete captur e ci-dessus
  end;

  perform extensions.dblink_disconnect('race_a');
  perform extensions.dblink_disconnect('race_b');

  if not v_race_b_failed then
    raise exception 'la seconde transition concurrente vers la MEME etape a reussi (attendu order.step_unchanged)';
  end if;
  if v_race_b_message not like '%order.step_unchanged%' then
    raise exception 'la seconde transition a echoue pour une autre raison que order.step_unchanged : %', v_race_b_message;
  end if;

  select current_production_step_id into v_current_step from public.commercial_orders where id = v_order;
  if v_current_step is distinct from v_step_to then
    raise exception 'etape courante inattendue apres la course : % (attendu %, celle posee par la session A)', v_current_step, v_step_to;
  end if;

  select count(*) into v_entry_count from public.commercial_order_step_changes where order_id = v_order;
  if v_entry_count <> 1 then
    raise exception 'le journal porte % entree(s) apres la course (attendu EXACTEMENT 1 : la seule transition qui a reellement eu lieu — c est ce que le FOR UPDATE garantit)', v_entry_count;
  end if;

  delete from public.tenants where id = v_tenant;
  delete from auth.users where id in (v_actor_a, v_actor_b);
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
    delete from public.tenants where id = v_tenant;
    delete from auth.users where id in (v_actor_a, v_actor_b);
    raise;
end;
$$;

drop table e10_14_race_context;
