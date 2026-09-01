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
--   2bis. Un client `individual` sans civilite est refuse (CHECK, M3).
--   3. Un membre du tenant B ne lit ni n ecrit les clients du tenant A (RLS),
--      AVEC controle positif symetrique en lecture ET en ecriture sur son
--      propre tenant (m1 qa-review : un test qui ne verifie que le refus
--      laisserait passer une policy d ecriture cassee en permanence).
--   4. Poser `is_primary = true` sur un second interlocuteur bascule
--      automatiquement l ancien principal a `false`, dans la meme
--      transaction (trigger + index unique partiel).
--   5. (M5 qa-review) Meme isolation que le scenario 3, mais sur
--      `customer_contacts` : ses policies reposent sur une jointure
--      `customers` x `tenant_members` distincte de celle de `customers`,
--      jamais exercee jusqu ici — cette table porte des PII (nom, email,
--      telephone des interlocuteurs).
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_4_customers_context (
  actor_id uuid not null,
  tenant_a uuid not null,
  tenant_b uuid not null,
  customer_a uuid not null,
  customer_b uuid not null,
  contact_a uuid not null,
  contact_b uuid not null
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
  v_contact_a uuid;
  v_contact_b uuid;
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

  -- 2bis. Client individual sans civilite (M3) -> refuse, meme avec nom/prenom.
  v_rejected := false;
  begin
    insert into public.customers (tenant_id, type, first_name, last_name)
    values (v_tenant_a, 'individual', 'Sans', 'Civilite');
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Un client individual sans civilite a ete accepte';
  end if;

  -- Clients valides, un par tenant.
  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression', '73282932000074')
  returning id into v_customer_a;

  insert into public.customers (tenant_id, type, civility, first_name, last_name)
  values (v_tenant_b, 'individual', 'mr', 'Jean', 'Dupont')
  returning id into v_customer_b;

  -- Un interlocuteur par client, pour le scenario 5 (RLS customer_contacts).
  insert into public.customer_contacts (customer_id, first_name, last_name, email)
  values (v_customer_a, 'Contact', 'TenantA', 'contact.tenant-a@example.test')
  returning id into v_contact_a;

  insert into public.customer_contacts (customer_id, first_name, last_name, email)
  values (v_customer_b, 'Contact', 'TenantB', 'contact.tenant-b@example.test')
  returning id into v_contact_b;

  insert into e10_4_customers_context (
    actor_id, tenant_a, tenant_b, customer_a, customer_b, contact_a, contact_b
  ) values (v_actor, v_tenant_a, v_tenant_b, v_customer_a, v_customer_b, v_contact_a, v_contact_b);
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

-- ── 3. et 5. Isolation par tenant, exercee via les policies reelles ────────
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
  v_customer_b uuid;
  v_contact_a uuid;
  v_contact_b uuid;
  v_visible_a integer;
  v_visible_b integer;
  v_contacts_visible_a integer;
  v_contacts_visible_b integer;
  v_updated integer;
  v_email text;
begin
  select tenant_a, tenant_b, customer_a, customer_b, contact_a, contact_b
    into v_tenant_a, v_tenant_b, v_customer_a, v_customer_b, v_contact_a, v_contact_b
    from e10_4_customers_context;

  -- 3. Lecture customers : rien du tenant A, controle positif sur le tenant B.
  select count(*) into v_visible_a from public.customers where tenant_id = v_tenant_a;
  if v_visible_a <> 0 then
    raise exception 'Un membre du tenant B lit % client(s) du tenant A', v_visible_a;
  end if;

  select count(*) into v_visible_b from public.customers where tenant_id = v_tenant_b;
  if v_visible_b <> 1 then
    raise exception 'Un membre du tenant B lit % client(s) de son propre tenant, 1 attendu', v_visible_b;
  end if;

  -- Ecriture customers : un membre du tenant B ne peut pas desactiver un
  -- client du tenant A. La policy `with check` bloque la ligne, l UPDATE
  -- affecte 0 ligne plutot que de lever une erreur — RLS filtre la CIBLE
  -- avant l ecriture.
  update public.customers set is_active = false where id = v_customer_a;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Un membre du tenant B a pu modifier un client du tenant A';
  end if;

  -- m1 (qa-review) : controle positif symetrique en ECRITURE sur customers.
  -- Sans lui, une policy customers_write cassee en permanence (ex. `using
  -- (false)`) passerait le controle negatif ci-dessus pour la mauvaise
  -- raison.
  update public.customers set vat_number = 'FR00000000000' where id = v_customer_b;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception
      'Un membre du tenant B n a pas pu modifier son propre client (% ligne(s))', v_updated;
  end if;

  -- 5 (M5 qa-review) : meme isolation sur customer_contacts, dont la policy
  -- repose sur une jointure customers x tenant_members DIFFERENTE de celle
  -- de customers — jamais exercee avant ce test, alors que la table porte
  -- des PII (nom, email, telephone).
  select count(*) into v_contacts_visible_a
    from public.customer_contacts where id = v_contact_a;
  if v_contacts_visible_a <> 0 then
    raise exception
      'Un membre du tenant B lit % interlocuteur(s) du tenant A', v_contacts_visible_a;
  end if;

  select count(*) into v_contacts_visible_b
    from public.customer_contacts where customer_id = v_customer_b;
  -- v_contact_b + Alice/Bob du scenario 4 = 3 interlocuteurs sur le client B.
  if v_contacts_visible_b <> 3 then
    raise exception
      'Un membre du tenant B lit % interlocuteur(s) de son propre client, 3 attendus',
      v_contacts_visible_b;
  end if;

  -- Ecriture customer_contacts : refus sur l interlocuteur du tenant A.
  update public.customer_contacts set last_name = 'Modifie' where id = v_contact_a;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Un membre du tenant B a pu modifier un interlocuteur du tenant A';
  end if;

  -- Controle positif : ecriture acceptee sur l interlocuteur de son propre
  -- client.
  update public.customer_contacts set phone = '0600000000' where id = v_contact_b;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception
      'Un membre du tenant B n a pas pu modifier un interlocuteur de son propre client (% ligne(s))',
      v_updated;
  end if;
  select phone into v_email from public.customer_contacts where id = v_contact_b;
  if v_email is distinct from '0600000000' then
    raise exception
      'La modification du telephone de l interlocuteur du tenant B ne s est pas appliquee (valeur: %)',
      v_email;
  end if;
end;
$$;

reset role;

-- Aucune ligne bloquee ci-dessus n a ete modifiee (customers ET customer_contacts).
do $$
declare
  v_customer_a uuid;
  v_contact_a uuid;
  v_still_active boolean;
  v_still_last_name text;
begin
  select customer_a, contact_a into v_customer_a, v_contact_a from e10_4_customers_context;

  select is_active into v_still_active from public.customers where id = v_customer_a;
  if v_still_active is not true then
    raise exception 'Le client du tenant A a ete desactive malgre le blocage RLS attendu';
  end if;

  select last_name into v_still_last_name from public.customer_contacts where id = v_contact_a;
  if v_still_last_name <> 'TenantA' then
    raise exception
      'L interlocuteur du tenant A a ete modifie malgre le blocage RLS attendu (valeur: %)',
      v_still_last_name;
  end if;
end;
$$;

rollback;
