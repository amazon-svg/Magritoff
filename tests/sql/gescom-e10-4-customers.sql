-- ============================================================================
-- E10.4 — customers / customer_contacts : isolation par tenant, contraintes de
-- forme, bascule atomique de l interlocuteur principal.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-outbox-append-only.sql : une migration ne change jamais apres
-- coup, un `toContain()` sur son texte ne detecte donc aucune regression sur
-- un futur `drop policy` ou une contrainte assouplie par erreur).
--
-- Scenarios :
--   1. Un client `company` sans SIRET est refuse (CHECK).
--   2. Un SIRET a 13 chiffres est refuse (CHECK de forme).
--   3. Un membre du tenant B ne lit ni n ecrit les clients du tenant A (RLS).
--   4. Poser `is_primary = true` sur un second interlocuteur bascule
--      automatiquement l ancien principal a `false`, dans la meme
--      transaction (trigger + index unique partiel).
--   5. Un role client (`authenticated`, `anon`) sans policy ne lit rien d un
--      tenant dont il n est pas membre — verifie via la policy elle-meme,
--      pas seulement sa presence textuelle.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_4_customers_context (
  actor_id uuid not null,
  tenant_a uuid not null,
  tenant_b uuid not null,
  customer_a uuid not null,
  customer_b uuid not null
);

grant select on e10_4_customers_context to authenticated;

-- ── Contraintes de forme, jouees en tant que postgres (avant tout test RLS) ─
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_rejected boolean := false;
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
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.4';
  end if;

  insert into public.tenants (slug, name) values ('e10-4-customers-a', 'E10.4 Customers Tenant A')
    returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-4-customers-b', 'E10.4 Customers Tenant B')
    returning id into v_tenant_b;

  -- L acteur n est membre QUE du tenant B.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_b, v_actor, 'admin', 'magrit_full', '{}');

  -- 1. Client company sans SIRET -> refuse.
  begin
    insert into public.customers (tenant_id, type, company_name)
    values (v_tenant_a, 'company', 'Sans Siret SARL');
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un client company sans SIRET a ete accepte';
  end if;

  -- 2. SIRET a 13 chiffres -> refuse (forme).
  v_rejected := false;
  begin
    insert into public.customers (tenant_id, type, company_name, siret)
    values (v_tenant_a, 'company', 'Siret Court SARL', '1234567890123');
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un SIRET a 13 chiffres a ete accepte';
  end if;

  -- Client individual sans nom/prenom -> refuse.
  v_rejected := false;
  begin
    insert into public.customers (tenant_id, type) values (v_tenant_a, 'individual');
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un client individual sans nom ni prenom a ete accepte';
  end if;

  -- Clients valides, un par tenant.
  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression', '73282932000074')
  returning id into v_customer_a;

  insert into public.customers (tenant_id, type, first_name, last_name)
  values (v_tenant_b, 'individual', 'Jean', 'Dupont')
  returning id into v_customer_b;

  insert into e10_4_customers_context (actor_id, tenant_a, tenant_b, customer_a, customer_b)
  values (v_actor, v_tenant_a, v_tenant_b, v_customer_a, v_customer_b);
end;
$$;

-- ── 4. Bascule atomique de l interlocuteur principal ────────────────────────
do $$
declare
  v_customer_b uuid;
  v_first uuid;
  v_second uuid;
  v_first_primary boolean;
  v_second_primary boolean;
  v_primary_count integer;
begin
  select customer_b into v_customer_b from e10_4_customers_context;

  insert into public.customer_contacts (customer_id, first_name, last_name, email, is_primary)
  values (v_customer_b, 'Alice', 'Martin', 'alice.martin@example.test', true)
  returning id into v_first;

  insert into public.customer_contacts (customer_id, first_name, last_name, email, is_primary)
  values (v_customer_b, 'Bob', 'Durand', 'bob.durand@example.test', true)
  returning id into v_second;

  select is_primary into v_first_primary from public.customer_contacts where id = v_first;
  select is_primary into v_second_primary from public.customer_contacts where id = v_second;
  select count(*) into v_primary_count
    from public.customer_contacts
   where customer_id = v_customer_b and is_primary;

  if v_first_primary is not false then
    raise exception 'Le premier interlocuteur principal n a pas ete retrograde';
  end if;
  if v_second_primary is not true then
    raise exception 'Le second interlocuteur n a pas ete promu principal';
  end if;
  if v_primary_count <> 1 then
    raise exception 'Le client porte % interlocuteur(s) principal(aux), 1 attendu', v_primary_count;
  end if;

  -- Repasser explicitement Alice en principal doit desormais retrograder Bob.
  update public.customer_contacts set is_primary = true where id = v_first;
  select is_primary into v_second_primary from public.customer_contacts where id = v_second;
  if v_second_primary is not false then
    raise exception 'Le second interlocuteur est reste principal apres reprise du premier';
  end if;
end;
$$;

-- ── 3. et 5. Isolation par tenant, exercee via la policy reelle ────────────
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from e10_4_customers_context),
  true
);

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_visible_a integer;
  v_visible_b integer;
  v_updated integer;
begin
  select tenant_a, tenant_b, customer_a into v_tenant_a, v_tenant_b, v_customer_a
    from e10_4_customers_context;

  select count(*) into v_visible_a from public.customers where tenant_id = v_tenant_a;
  if v_visible_a <> 0 then
    raise exception 'Un membre du tenant B lit % client(s) du tenant A', v_visible_a;
  end if;

  select count(*) into v_visible_b from public.customers where tenant_id = v_tenant_b;
  if v_visible_b <> 1 then
    raise exception 'Un membre du tenant B lit % client(s) de son propre tenant, 1 attendu', v_visible_b;
  end if;

  -- Ecriture : un membre du tenant B ne peut pas desactiver un client du
  -- tenant A. La policy `with check` bloque la ligne, l UPDATE affecte 0 ligne
  -- plutot que de lever une erreur — RLS filtre la CIBLE avant l ecriture.
  update public.customers set is_active = false where id = v_customer_a;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Un membre du tenant B a pu modifier un client du tenant A';
  end if;
end;
$$;

reset role;

-- Aucune ligne n a ete modifiee par la tentative bloquee ci-dessus.
do $$
declare
  v_customer_a uuid;
  v_still_active boolean;
begin
  select customer_a into v_customer_a from e10_4_customers_context;
  select is_active into v_still_active from public.customers where id = v_customer_a;
  if v_still_active is not true then
    raise exception 'Le client du tenant A a ete desactive malgre le blocage RLS attendu';
  end if;
end;
$$;

rollback;
