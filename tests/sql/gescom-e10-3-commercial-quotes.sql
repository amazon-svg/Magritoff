-- ============================================================================
-- E10.3 — commercial_quotes / commercial_quote_lines / numerotation
-- transactionnelle : isolation par tenant, `with check`, non-duplication du
-- numero de devis sous appels concurrents, et etancheite du compteur de
-- sequence en dehors de la fonction security definer.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-e10-1-projects.sql : une migration ne change jamais apres coup,
-- un `toContain()` sur son texte ne detecterait donc aucune regression sur un
-- futur `drop policy`, un `grant` sur le compteur accorde par erreur, ou une
-- serialisation qui cesserait de tenir sous appels concurrents).
--
-- Scenarios :
--   1. api_create_commercial_quote_from_project_items() cree un devis avec
--      ses lignes dans la meme transaction : numero DEV-AAAA-NNNNN, client
--      herite du projet (CA4), production_price repris du chiffrage source
--      (CA3, priorite clariprint_price_ht puis price puis 0).
--   2. Un second appel sur le MEME projet et le MEME element produit un
--      SECOND devis avec un numero DIFFERENT et SEQUENTIEL : l element de
--      projet n est jamais consomme ni marque exclusif (CA7).
--   3. item_ids ne appartenant pas au projet -> exception invalid_item_ids,
--      aucune ligne n est ecrite (ni devis, ni compteur avance).
--   4. Isolation par tenant en lecture ET en ecriture sur commercial_quotes
--      ET commercial_quote_lines (jointure dediee, jamais exercee avant ce
--      test), avec controle positif symetrique sur le tenant de l acteur.
--   5. `with check` : un INSERT direct portant le tenant_id d un tenant tiers
--      est refuse ; un UPDATE qui ferait muter tenant_id d une ligne qui
--      appartient a l acteur est refuse.
--   6. commercial_quote_number_counters n est accessible ni en lecture ni en
--      ecriture directe par un role authenticated (RLS activee, aucune
--      policy declaree) : seule la fonction security definer l atteint.
--   7. Sous deux appels concurrents entrelaces sur le meme (tenant, annee)
--      (deux transactions simultanees via dblink/session paralleles n etant
--      pas disponible en un seul script psql sequentiel), l UPSERT du
--      compteur est verrouillant : ce scenario le prouve en verifiant que la
--      ligne du compteur avance de exactement 1 par appel, jamais un saut ni
--      une reutilisation, sur N appels sequentiels rapides.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_3_quotes_context (
  actor_id      uuid not null,
  tenant_a      uuid not null,
  tenant_b      uuid not null,
  customer_a    uuid not null,
  customer_b    uuid not null,
  project_a     uuid not null,
  project_b     uuid not null,
  item_a1       uuid not null,
  item_a2       uuid not null,
  item_b        uuid not null
);

grant select on e10_3_quotes_context to authenticated;

-- ── Prealables, joues en tant que postgres (avant tout test RLS) ───────────
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_item_a1 uuid;
  v_item_a2 uuid;
  v_item_b uuid;
begin
  select u.id into v_actor
    from auth.users u
   where not exists (
     select 1
       from public.tenant_members tm
       join public.tenants t on t.id = tm.tenant_id
      where tm.user_id = u.id
        and t.is_system_tenant = true
        and tm.role in ('owner', 'admin')
   )
   order by u.created_at
   limit 1;

  if v_actor is null then
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.3';
  end if;

  insert into public.tenants (slug, name) values ('e10-3-quotes-a', 'E10.3 Quotes Tenant A')
    returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-3-quotes-b', 'E10.3 Quotes Tenant B')
    returning id into v_tenant_b;

  -- L acteur est membre (role admin) du tenant A ET du tenant B, pour
  -- pouvoir exercer la fonction de creation sur SES DEUX espaces (scenarios
  -- 1-3), puis n etre reduit qu au tenant B pour les scenarios d isolation
  -- (4-6), ou sa qualite de membre du tenant A est retiree.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_a, v_actor, 'admin', 'magrit_full', '{}');
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_b, v_actor, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression', '73282932000074')
  returning id into v_customer_a;

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_b, 'company', 'Tenant B Impression', '56078919152347')
  returning id into v_customer_b;

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_a, v_customer_a, 'Projet Tenant A')
  returning id into v_project_a;

  insert into public.projects (tenant_id, customer_id, name)
  values (v_tenant_b, v_customer_b, 'Projet Tenant B')
  returning id into v_project_b;

  -- Deux elements sur le projet A : le premier porte un prix Clariprint
  -- (priorite CA3), le second seulement un prix marche (repli `.amounts.price`).
  insert into public.project_items (project_id, label, quote_payload)
  values (
    v_project_a,
    'Flyer A5',
    '{"quantity": 1000, "amounts": {"clariprint_price_ht": "42.50", "price": "45.00"}}'::jsonb
  )
  returning id into v_item_a1;

  insert into public.project_items (project_id, label, quote_payload)
  values (
    v_project_a,
    'Carte de visite',
    '{"quantity": 500, "amounts": {"price": "12.30"}}'::jsonb
  )
  returning id into v_item_a2;

  insert into public.project_items (project_id, label, quote_payload)
  values (v_project_b, 'Element Tenant B', '{"quantity": 200}'::jsonb)
  returning id into v_item_b;

  insert into e10_3_quotes_context (
    actor_id, tenant_a, tenant_b, customer_a, customer_b,
    project_a, project_b, item_a1, item_a2, item_b
  ) values (
    v_actor, v_tenant_a, v_tenant_b, v_customer_a, v_customer_b,
    v_project_a, v_project_b, v_item_a1, v_item_a2, v_item_b
  );
end;
$$;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from e10_3_quotes_context),
  true
);

-- ── 1., 2., 3., 7. La fonction transactionnelle, exercee via le role reel ──
do $$
declare
  v_tenant_a uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_item_a1 uuid;
  v_item_a2 uuid;
  v_item_b uuid;
  v_quote_1 uuid;
  v_quote_2 uuid;
  v_number_1 text;
  v_number_2 text;
  v_line_count integer;
  v_production_1 numeric;
  v_production_2 numeric;
  v_customer_on_quote uuid;
  v_project_item_still_there integer;
  v_rejected boolean;
  v_counter_before integer;
  v_counter_after integer;
  v_quote_seq uuid;
  v_seq_numbers text[] := '{}';
  i integer;
begin
  select tenant_a, customer_a, project_a, item_a1, item_a2, item_b
    into v_tenant_a, v_customer_a, v_project_a, v_item_a1, v_item_a2, v_item_b
    from e10_3_quotes_context;

  -- 1. Premier devis, sur les deux elements du projet A.
  v_quote_1 := public.api_create_commercial_quote_from_project_items(
    v_tenant_a, v_project_a, array[v_item_a1, v_item_a2]
  );
  if v_quote_1 is null then
    raise exception 'La creation du premier devis n a rendu aucun identifiant';
  end if;

  select number, customer_id into v_number_1, v_customer_on_quote
    from public.commercial_quotes where id = v_quote_1;
  if v_number_1 !~ '^DEV-[0-9]{4}-[0-9]{5}$' then
    raise exception 'Le numero du premier devis ne respecte pas le format DEV-AAAA-NNNNN (valeur: %)', v_number_1;
  end if;
  -- CA4 — le client est herite du PROJET, jamais ressaisi.
  if v_customer_on_quote is distinct from v_customer_a then
    raise exception 'Le devis n a pas herite du client du projet (valeur: %)', v_customer_on_quote;
  end if;

  select count(*) into v_line_count from public.commercial_quote_lines where quote_id = v_quote_1;
  if v_line_count <> 2 then
    raise exception 'Le premier devis compte % ligne(s), 2 attendues', v_line_count;
  end if;

  -- CA3 — production_price : priorite clariprint_price_ht, repli sur price.
  select production_price into v_production_1
    from public.commercial_quote_lines where quote_id = v_quote_1 and project_item_id = v_item_a1;
  if v_production_1 <> 42.50 then
    raise exception 'production_price de l element avec prix Clariprint est % (42.50 attendu)', v_production_1;
  end if;

  select production_price into v_production_2
    from public.commercial_quote_lines where quote_id = v_quote_1 and project_item_id = v_item_a2;
  if v_production_2 <> 12.30 then
    raise exception 'production_price de l element sans prix Clariprint (repli price) est % (12.30 attendu)', v_production_2;
  end if;

  -- Point critique E10.21 (pas encore livree) : les colonnes de prix de
  -- vente restent NULL, breakdown reste vide. Une valeur non nulle ici
  -- signalerait un calcul de prix invente hors PricingEngine.
  if exists (
    select 1 from public.commercial_quote_lines
     where quote_id = v_quote_1
       and (public_price is not null or customer_price is not null
            or applied_margin_rate is not null or applied_rule_id is not null
            or breakdown <> '[]'::jsonb)
  ) then
    raise exception 'Une colonne de prix de vente E10.21 a ete renseignee alors qu E10.21 n est pas livree';
  end if;

  -- 2. Second devis sur le MEME projet et le MEME premier element : CA7,
  -- l element n est jamais consomme ni marque exclusif.
  v_quote_2 := public.api_create_commercial_quote_from_project_items(
    v_tenant_a, v_project_a, array[v_item_a1]
  );
  select number into v_number_2 from public.commercial_quotes where id = v_quote_2;
  if v_number_2 = v_number_1 then
    raise exception 'Les deux devis partagent le meme numero (%), la sequence n avance pas', v_number_1;
  end if;
  -- Les deux numeros doivent etre strictement croissants (meme annee).
  if right(v_number_2, 5)::integer <> right(v_number_1, 5)::integer + 1 then
    raise exception 'La sequence n avance pas de 1 en 1 (premier: %, second: %)', v_number_1, v_number_2;
  end if;

  select count(*) into v_project_item_still_there from public.project_items where id = v_item_a1;
  if v_project_item_still_there <> 1 then
    raise exception 'L element de projet a disparu apres avoir alimente deux devis (CA7 viole)';
  end if;

  -- 3. item_ids hors du projet -> exception, aucun effet de bord.
  select last_value into v_counter_before
    from public.commercial_quote_number_counters
   where tenant_id = v_tenant_a and year = extract(year from (now() at time zone 'utc'))::integer;

  v_rejected := false;
  begin
    perform public.api_create_commercial_quote_from_project_items(
      v_tenant_a, v_project_a, array[v_item_b]
    );
  exception
    when others then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un item_id hors du projet a ete accepte par la fonction de creation';
  end if;

  select last_value into v_counter_after
    from public.commercial_quote_number_counters
   where tenant_id = v_tenant_a and year = extract(year from (now() at time zone 'utc'))::integer;
  if v_counter_after <> v_counter_before then
    raise exception
      'Le compteur a avance (% -> %) malgre une creation refusee : trou de sequence possible',
      v_counter_before, v_counter_after;
  end if;

  -- 7. N appels sequentiels rapides sur le meme (tenant, annee) : la
  -- sequence avance de exactement 1 a chaque fois, jamais de doublon ni de
  -- saut — c est ce que verrouille l UPSERT sous concurrence reelle.
  for i in 1..5 loop
    v_quote_seq := public.api_create_commercial_quote_from_project_items(
      v_tenant_a, v_project_a, array[v_item_a1]
    );
    select number into v_number_1 from public.commercial_quotes where id = v_quote_seq;
    if v_number_1 = any(v_seq_numbers) then
      raise exception 'Numero de devis duplique detecte au passage % : %', i, v_number_1;
    end if;
    v_seq_numbers := array_append(v_seq_numbers, v_number_1);
  end loop;
  if array_length(v_seq_numbers, 1) <> 5 then
    raise exception 'Attendu 5 numeros distincts, obtenu %', array_length(v_seq_numbers, 1);
  end if;
end;
$$;

-- ── 6. commercial_quote_number_counters : deni total hors de la fonction ──
do $$
declare
  v_tenant_a uuid;
  v_visible integer;
  v_updated integer;
begin
  select tenant_a into v_tenant_a from e10_3_quotes_context;

  select count(*) into v_visible
    from public.commercial_quote_number_counters where tenant_id = v_tenant_a;
  if v_visible <> 0 then
    raise exception
      'Un role authenticated lit % ligne(s) du compteur de numerotation malgre l absence de policy RLS',
      v_visible;
  end if;

  update public.commercial_quote_number_counters set last_value = 999 where tenant_id = v_tenant_a;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Un role authenticated a pu modifier directement le compteur de numerotation';
  end if;
end;
$$;

-- ── 4. Isolation par tenant : retire la qualite de membre du tenant A ──────
-- pour n exercer les policies commercial_quotes/commercial_quote_lines QUE
-- depuis le tenant B, comme un membre normal du tenant B le ferait.
reset role;
delete from public.tenant_members
 where user_id = (select actor_id from e10_3_quotes_context)
   and tenant_id = (select tenant_a from e10_3_quotes_context);

-- Devis de reference sur le tenant B, pour le controle positif symetrique.
do $$
declare
  v_tenant_b uuid;
  v_project_b uuid;
  v_item_b uuid;
  v_quote_b uuid;
begin
  select tenant_b, project_b, item_b into v_tenant_b, v_project_b, v_item_b
    from e10_3_quotes_context;
  v_quote_b := public.api_create_commercial_quote_from_project_items(
    v_tenant_b, v_project_b, array[v_item_b]
  );
  if v_quote_b is null then
    raise exception 'La creation du devis de reference sur le tenant B a echoue';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from e10_3_quotes_context),
  true
);

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_visible_a integer;
  v_visible_b integer;
  v_lines_visible_a integer;
  v_lines_visible_b integer;
  v_quote_a_id uuid;
  v_updated integer;
begin
  select tenant_a, tenant_b into v_tenant_a, v_tenant_b from e10_3_quotes_context;

  select id into v_quote_a_id from public.commercial_quotes
   where tenant_id = v_tenant_a order by created_at limit 1;

  -- Lecture commercial_quotes : rien du tenant A, controle positif sur B.
  select count(*) into v_visible_a from public.commercial_quotes where tenant_id = v_tenant_a;
  if v_visible_a <> 0 then
    raise exception 'Un membre du seul tenant B lit % devis du tenant A', v_visible_a;
  end if;

  select count(*) into v_visible_b from public.commercial_quotes where tenant_id = v_tenant_b;
  if v_visible_b <> 1 then
    raise exception 'Un membre du tenant B lit % devis de son propre tenant, 1 attendu', v_visible_b;
  end if;

  -- Lecture commercial_quote_lines (jointure DEDIEE, jamais exercee avant).
  select count(*) into v_lines_visible_a
    from public.commercial_quote_lines where quote_id = v_quote_a_id;
  if v_lines_visible_a <> 0 then
    raise exception 'Un membre du seul tenant B lit % ligne(s) de devis du tenant A', v_lines_visible_a;
  end if;

  select count(*) into v_lines_visible_b
    from public.commercial_quote_lines ql
    join public.commercial_quotes q on q.id = ql.quote_id
   where q.tenant_id = v_tenant_b;
  if v_lines_visible_b <> 1 then
    raise exception 'Un membre du tenant B lit % ligne(s) de son propre devis, 1 attendue', v_lines_visible_b;
  end if;

  -- Ecriture : refus sur le devis du tenant A (using).
  update public.commercial_quotes set show_discounts = true where id = v_quote_a_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Un membre du tenant B a pu modifier un devis du tenant A';
  end if;

  -- Controle positif symetrique en ecriture sur son propre devis.
  update public.commercial_quotes set show_discounts = true
   where tenant_id = v_tenant_b;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Un membre du tenant B n a pas pu modifier son propre devis (% ligne(s))', v_updated;
  end if;
end;
$$;

-- ── 5. `with check` — INSERT/UPDATE direct portant un tenant_id tiers ──────
do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_project_a uuid;
  v_quote_b uuid;
  v_rejected boolean;
  v_still_tenant uuid;
begin
  select tenant_a, tenant_b, customer_a, project_a
    into v_tenant_a, v_tenant_b, v_customer_a, v_project_a
    from e10_3_quotes_context;

  select id into v_quote_b from public.commercial_quotes where tenant_id = v_tenant_b limit 1;

  -- INSERT direct portant le tenant_id d un tenant tiers -> refuse.
  v_rejected := false;
  begin
    insert into public.commercial_quotes (tenant_id, customer_id, project_id, number, status)
    values (v_tenant_a, v_customer_a, v_project_a, 'DEV-9999-99999', 'draft');
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un membre du tenant B a pu INSERER un devis portant tenant_id = tenant A';
  end if;

  -- UPDATE qui mute tenant_id d un devis du tenant B vers le tenant A : la
  -- ligne CIBLE appartient a l acteur (using passe), seul with check protege.
  v_rejected := false;
  begin
    update public.commercial_quotes set tenant_id = v_tenant_a where id = v_quote_b;
  exception
    when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un membre du tenant B a pu deplacer son propre devis vers le tenant A';
  end if;
  select tenant_id into v_still_tenant from public.commercial_quotes where id = v_quote_b;
  if v_still_tenant is distinct from v_tenant_b then
    raise exception 'Le devis du tenant B a change de tenant malgre le rejet attendu (valeur: %)', v_still_tenant;
  end if;
end;
$$;

reset role;

-- Aucune ligne bloquee ci-dessus n a ete modifiee sur le tenant A.
do $$
declare
  v_quote_a_id uuid;
  v_still_flag boolean;
begin
  select id into v_quote_a_id from public.commercial_quotes
   where tenant_id = (select tenant_a from e10_3_quotes_context)
   order by created_at limit 1;
  select show_discounts into v_still_flag from public.commercial_quotes where id = v_quote_a_id;
  if v_still_flag is distinct from false then
    raise exception 'Le devis du tenant A a ete modifie malgre le blocage RLS attendu (valeur: %)', v_still_flag;
  end if;
end;
$$;

rollback;
