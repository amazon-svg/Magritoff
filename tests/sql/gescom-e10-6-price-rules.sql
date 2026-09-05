-- ============================================================================
-- E10.6 — price_rules / price_rules_audit / product_range_default_margins :
-- coherence scope<->cibles, ordre des periodes, isolation par tenant (RLS),
-- journal d audit append-only.
-- ----------------------------------------------------------------------------
-- Test COMPORTEMENTAL, execute par psql contre la base locale (meme raison
-- que gescom-outbox-append-only.sql / gescom-e10-4-customers.sql : une
-- migration ne change jamais apres coup, un `toContain()` sur son texte ne
-- detecterait donc aucune regression future).
--
-- Scenarios :
--   1. Coherence scope <-> cibles (CHECK), dans LES DEUX SENS : `customer`
--      sans `customer_id`, `global` AVEC `customer_id`, `range` sans
--      `product_range_id`, `customer_range` avec les deux -> accepte.
--   2. Ordre des periodes : `valid_to` INCLUS — `valid_to < valid_from` refuse,
--      `valid_to = valid_from` (regle d un seul jour) accepte.
--   3. `name` vide et `value` negatif refuses (CHECK).
--   4. Isolation par tenant sur `price_rules`, AVEC controle positif
--      symetrique en lecture ET en ecriture (m1 qa-review E10.4 : un test qui
--      ne verifie que le refus laisserait passer une policy cassee en
--      permanence).
--   5. Meme isolation sur `product_range_default_margins`, AVEC le meme
--      controle negatif d ecriture cross-tenant que le scenario 4 (qa-review
--      E10.6, B3) : un membre du tenant B ne peut pas creer de marge standard
--      pour une gamme au nom du tenant A.
--   6. Journal d audit (CA6) : une creation journalise `created` ; un UPDATE
--      qui ne bascule QUE `is_active` journalise `activated`/`deactivated` ;
--      toute autre modification journalise `updated`.
--   7. `price_rules_audit` est append-only : `authenticated` ne peut ni
--      l ecrire directement, ni la modifier, ni la supprimer (grants), au-dela
--      de ce que la RLS filtre deja. Isolation en LECTURE testee aussi
--      (qa-review E10.6, B3) : un membre du tenant B lit ses propres lignes
--      d audit mais aucune de celles du tenant A.
--
-- Lancer : pnpm test:storefront:sql (necessite Supabase local demarre).
-- ============================================================================

begin;

create temporary table e10_6_price_rules_context (
  actor_id uuid not null,
  tenant_a uuid not null,
  tenant_b uuid not null,
  customer_a uuid not null,
  customer_b uuid not null,
  gamme_a uuid not null,
  rule_b uuid not null,
  toggle_rule_b uuid not null
);

grant select on e10_6_price_rules_context to authenticated;

-- ── Contraintes de forme et de coherence, jouees en tant que postgres ──────
do $$
declare
  v_actor uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_gamme_a uuid;
  v_rule_a uuid;
  v_rule_b uuid;
  v_toggle_rule_b uuid;
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
    raise exception 'Un utilisateur Auth non super-admin est requis pour le scenario E10.6';
  end if;

  insert into public.tenants (slug, name) values ('e10-6-price-rules-a', 'E10.6 Price Rules Tenant A')
    returning id into v_tenant_a;
  insert into public.tenants (slug, name) values ('e10-6-price-rules-b', 'E10.6 Price Rules Tenant B')
    returning id into v_tenant_b;

  -- L acteur n est membre QUE du tenant B.
  insert into public.tenant_members (tenant_id, user_id, role, access_scope, allowed_shop_ids)
  values (v_tenant_b, v_actor, 'admin', 'magrit_full', '{}');

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_a, 'company', 'Tenant A Impression', '73282932000074')
  returning id into v_customer_a;

  insert into public.customers (tenant_id, type, company_name, siret)
  values (v_tenant_b, 'company', 'Tenant B Impression', '56078919152347')
  returning id into v_customer_b;

  insert into public.product_gammes (slug, name) values ('e10-6-carterie', 'Carterie E10.6')
    returning id into v_gamme_a;

  -- 1a. scope='customer' sans customer_id -> refuse.
  begin
    insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
    values (v_tenant_a, 'Sans client', 'customer', 'margin_rate', 0.5000, '2026-09-01');
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Une regle scope=customer sans customer_id a ete acceptee';
  end if;

  -- 1b. scope='global' AVEC customer_id -> refuse (cible hors de sa portee).
  v_rejected := false;
  begin
    insert into public.price_rules (tenant_id, name, scope, customer_id, value_type, value, valid_from)
    values (v_tenant_a, 'Globale avec client', 'global', v_customer_a, 'margin_rate', 0.5000, '2026-09-01');
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Une regle scope=global avec un customer_id a ete acceptee';
  end if;

  -- 1c. scope='range' sans product_range_id -> refuse.
  v_rejected := false;
  begin
    insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
    values (v_tenant_a, 'Sans gamme', 'range', 'discount_rate', 0.1000, '2026-09-01');
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Une regle scope=range sans product_range_id a ete acceptee';
  end if;

  -- 1d. scope='customer_range' avec les deux cibles -> accepte (controle positif).
  insert into public.price_rules (
    tenant_id, name, scope, customer_id, product_range_id, value_type, value, valid_from
  ) values (
    v_tenant_a, 'Client + gamme OK', 'customer_range', v_customer_a, v_gamme_a, 'margin_rate', 0.5000, '2026-09-01'
  ) returning id into v_rule_a;
  if v_rule_a is null then
    raise exception 'Une regle scope=customer_range coherente a ete refusee';
  end if;

  -- 2a. valid_to STRICTEMENT anterieure a valid_from -> refuse.
  v_rejected := false;
  begin
    insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from, valid_to)
    values (v_tenant_a, 'Periode inversee', 'global', 'margin_rate', 0.3000, '2026-09-10', '2026-09-01');
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Une regle avec valid_to < valid_from a ete acceptee';
  end if;

  -- 2b. valid_to = valid_from -> accepte (regle d un seul jour, `valid_to`
  -- INCLUS, contrat openapi/magrit-core.v1.yaml).
  declare
    v_one_day_rule uuid;
  begin
    insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from, valid_to)
    values (v_tenant_a, 'Regle d un seul jour', 'global', 'margin_rate', 0.3000, '2026-09-10', '2026-09-10')
    returning id into v_one_day_rule;
    if v_one_day_rule is null then
      raise exception 'Une regle avec valid_to = valid_from a ete refusee';
    end if;
  end;

  -- 3a. name vide -> refuse.
  v_rejected := false;
  begin
    insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
    values (v_tenant_a, '   ', 'global', 'margin_rate', 0.3000, '2026-09-01');
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Une regle sans nom (espaces seuls) a ete acceptee';
  end if;

  -- 3b. value negatif -> refuse (le signe n est jamais dans `value`).
  v_rejected := false;
  begin
    insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
    values (v_tenant_a, 'Taux negatif', 'global', 'margin_rate', -0.1000, '2026-09-01');
  exception
    when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Une regle avec un taux negatif a ete acceptee';
  end if;

  -- Regle valide sur le tenant B (scenario 4, controle positif de lecture/ecriture).
  insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
  values (v_tenant_b, 'Regle tenant B', 'global', 'margin_rate', 0.2000, '2026-09-01')
  returning id into v_rule_b;

  -- Regle dediee au scenario 6 (bascule is_active), tenant B.
  insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
  values (v_tenant_b, 'Regle a basculer', 'global', 'margin_rate', 0.1500, '2026-09-01')
  returning id into v_toggle_rule_b;

  insert into e10_6_price_rules_context (
    actor_id, tenant_a, tenant_b, customer_a, customer_b, gamme_a, rule_b, toggle_rule_b
  ) values (v_actor, v_tenant_a, v_tenant_b, v_customer_a, v_customer_b, v_gamme_a, v_rule_b, v_toggle_rule_b);
end;
$$;

-- ── 6. Journal d audit (CA6), joue en tant que postgres ─────────────────────
do $$
declare
  v_rule_a uuid;
  v_toggle_rule_b uuid;
  v_created_count integer;
  v_last_action text;
begin
  select id into v_rule_a from public.price_rules where name = 'Client + gamme OK';
  select toggle_rule_b into v_toggle_rule_b from e10_6_price_rules_context;

  -- Une ligne 'created' par regle inseree ci-dessus (le trigger tourne sur
  -- CHAQUE insertion reussie, y compris les regles de controle positif).
  select count(*) into v_created_count
    from public.price_rules_audit
   where price_rule_id = v_rule_a and action = 'created';
  if v_created_count <> 1 then
    raise exception '% ligne(s) d audit "created" pour la regle de controle positif, 1 attendue', v_created_count;
  end if;

  -- Bascule is_active SEULE -> 'deactivated'.
  update public.price_rules set is_active = false where id = v_toggle_rule_b;
  select action into v_last_action
    from public.price_rules_audit
   where price_rule_id = v_toggle_rule_b
   order by occurred_at desc
   limit 1;
  if v_last_action <> 'deactivated' then
    raise exception
      'La desactivation seule a ete journalisee comme "%", "deactivated" attendu', v_last_action;
  end if;

  -- Reactivation seule -> 'activated'.
  update public.price_rules set is_active = true where id = v_toggle_rule_b;
  select action into v_last_action
    from public.price_rules_audit
   where price_rule_id = v_toggle_rule_b
   order by occurred_at desc
   limit 1;
  if v_last_action <> 'activated' then
    raise exception
      'La reactivation seule a ete journalisee comme "%", "activated" attendu', v_last_action;
  end if;

  -- Modification d un AUTRE champ (name) -> 'updated', jamais 'activated'/'deactivated'.
  update public.price_rules set name = 'Regle a basculer (renommee)' where id = v_toggle_rule_b;
  select action into v_last_action
    from public.price_rules_audit
   where price_rule_id = v_toggle_rule_b
   order by occurred_at desc
   limit 1;
  if v_last_action <> 'updated' then
    raise exception
      'Le renommage a ete journalise comme "%", "updated" attendu', v_last_action;
  end if;

  -- UPDATE no-op (aucune colonne changee) -> aucune ligne d audit supplementaire.
  select count(*) into v_created_count from public.price_rules_audit where price_rule_id = v_toggle_rule_b;
  update public.price_rules set name = name where id = v_toggle_rule_b;
  perform 1 from public.price_rules_audit where price_rule_id = v_toggle_rule_b;
  if (select count(*) from public.price_rules_audit where price_rule_id = v_toggle_rule_b) <> v_created_count then
    raise exception 'Un UPDATE no-op a produit une ligne d audit supplementaire';
  end if;
end;
$$;

-- ── 4., 5. et 7. Isolation par tenant et append-only, exercees via les
-- policies et les grants REELS ──────────────────────────────────────────────
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from e10_6_price_rules_context),
  true
);

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_customer_a uuid;
  v_gamme_a uuid;
  v_rule_b uuid;
  v_visible_a integer;
  v_visible_b integer;
  v_updated integer;
  v_rule_a_id uuid;
  v_insert_rejected boolean := false;
  v_margin_insert_rejected boolean := false;
  v_audit_insert_rejected boolean := false;
begin
  select tenant_a, tenant_b, customer_a, gamme_a, rule_b
    into v_tenant_a, v_tenant_b, v_customer_a, v_gamme_a, v_rule_b
    from e10_6_price_rules_context;

  -- 4. Lecture price_rules : rien du tenant A, controle positif sur B.
  select count(*) into v_visible_a from public.price_rules where tenant_id = v_tenant_a;
  if v_visible_a <> 0 then
    raise exception 'Un membre du tenant B lit % regle(s) de prix du tenant A', v_visible_a;
  end if;

  select count(*) into v_visible_b from public.price_rules where tenant_id = v_tenant_b;
  if v_visible_b <> 2 then
    raise exception 'Un membre du tenant B lit % regle(s) de son propre tenant, 2 attendues', v_visible_b;
  end if;

  -- Ecriture price_rules : refus sur le tenant A (RLS filtre la CIBLE, 0 ligne
  -- affectee plutot qu une erreur).
  update public.price_rules set is_active = false
   where tenant_id = v_tenant_a and name = 'Client + gamme OK'
   returning id into v_rule_a_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'Un membre du tenant B a pu modifier une regle de prix du tenant A';
  end if;

  -- Controle positif symetrique en ECRITURE sur son propre tenant.
  update public.price_rules set is_active = false where id = v_rule_b;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception
      'Un membre du tenant B n a pas pu modifier sa propre regle de prix (% ligne(s))', v_updated;
  end if;

  -- Un membre du tenant B ne peut pas non plus CREER une regle pour le tenant A.
  begin
    insert into public.price_rules (tenant_id, name, scope, value_type, value, valid_from)
    values (v_tenant_a, 'Injection depuis B', 'global', 'margin_rate', 0.1000, '2026-09-01');
  exception
    when insufficient_privilege or others then v_insert_rejected := true;
  end;
  -- La `with check` de la policy rejette la ligne (insufficient_privilege ou
  -- une exception RLS) ; a defaut d exception, verifier qu aucune ligne n a
  -- ete creee pour le tenant A par ce role.
  if not v_insert_rejected then
    perform 1 from public.price_rules where tenant_id = v_tenant_a and name = 'Injection depuis B';
    if found then
      raise exception 'Un membre du tenant B a pu creer une regle de prix pour le tenant A';
    end if;
  end if;

  -- 5. Isolation sur product_range_default_margins : controle positif d
  -- ecriture sur son propre tenant, puis lecture (rien du tenant A, controle
  -- positif sur B).
  insert into public.product_range_default_margins (tenant_id, product_range_id, margin_rate)
  values (v_tenant_b, v_gamme_a, 0.4000)
  on conflict (tenant_id, product_range_id) do update set margin_rate = excluded.margin_rate;

  select count(*) into v_visible_a
    from public.product_range_default_margins where tenant_id = v_tenant_a;
  if v_visible_a <> 0 then
    raise exception
      'Un membre du tenant B lit % marge(s) standard du tenant A', v_visible_a;
  end if;

  select count(*) into v_visible_b
    from public.product_range_default_margins where tenant_id = v_tenant_b;
  if v_visible_b <> 1 then
    raise exception
      'Un membre du tenant B lit % marge(s) standard de son propre tenant, 1 attendue', v_visible_b;
  end if;

  -- Controle negatif SYMETRIQUE en ECRITURE (qa-review E10.6, B3) : un membre
  -- du tenant B ne peut pas creer de marge standard au nom du tenant A, sur
  -- le modele exact du controle negatif deja fait pour price_rules
  -- ci-dessus (exception RLS, ou a defaut aucune ligne creee pour le tenant A).
  begin
    insert into public.product_range_default_margins (tenant_id, product_range_id, margin_rate)
    values (v_tenant_a, v_gamme_a, 0.9999);
  exception
    when insufficient_privilege or others then v_margin_insert_rejected := true;
  end;
  if not v_margin_insert_rejected then
    perform 1 from public.product_range_default_margins
     where tenant_id = v_tenant_a and product_range_id = v_gamme_a;
    if found then
      raise exception 'Un membre du tenant B a pu creer une marge standard pour le tenant A';
    end if;
  end if;

  -- 7. `price_rules_audit` : isolation en LECTURE (qa-review E10.6, B3),
  -- AVEC controle positif symetrique — un membre du tenant B lit ses propres
  -- lignes d audit (creees par les ecritures ci-dessus sur ses propres
  -- regles) mais aucune de celles du tenant A (regle de controle positif
  -- 'Client + gamme OK', creee pendant la phase privilegiee).
  select count(*) into v_visible_a from public.price_rules_audit where tenant_id = v_tenant_a;
  if v_visible_a <> 0 then
    raise exception 'Un membre du tenant B lit % ligne(s) d audit du tenant A', v_visible_a;
  end if;

  select count(*) into v_visible_b from public.price_rules_audit where tenant_id = v_tenant_b;
  if v_visible_b = 0 then
    raise exception 'Un membre du tenant B ne lit aucune ligne d audit de son propre tenant';
  end if;

  -- `price_rules_audit` : ecriture directe absente des grants — meme sous une
  -- session authentifiee legitime du tenant.
  begin
    insert into public.price_rules_audit (tenant_id, price_rule_id, action, after_state)
    values (v_tenant_b, v_rule_b, 'created', '{}'::jsonb);
  exception
    when insufficient_privilege then v_audit_insert_rejected := true;
  end;
  if not v_audit_insert_rejected then
    raise exception 'Un role authenticated a pu inserer directement dans price_rules_audit';
  end if;
end;
$$;

reset role;

-- Grants reels sur price_rules_audit : INSERT/UPDATE/DELETE absents pour
-- authenticated/anon (revoke explicite de la migration), au-dela du controle
-- comportemental ci-dessus.
do $$
declare
  v_insert_count integer;
  v_update_count integer;
  v_delete_count integer;
begin
  select count(*) into v_insert_count
    from information_schema.table_privileges
   where table_schema = 'public' and table_name = 'price_rules_audit'
     and grantee in ('authenticated', 'anon') and privilege_type = 'INSERT';
  select count(*) into v_update_count
    from information_schema.table_privileges
   where table_schema = 'public' and table_name = 'price_rules_audit'
     and grantee in ('authenticated', 'anon') and privilege_type = 'UPDATE';
  select count(*) into v_delete_count
    from information_schema.table_privileges
   where table_schema = 'public' and table_name = 'price_rules_audit'
     and grantee in ('authenticated', 'anon') and privilege_type = 'DELETE';

  if v_insert_count <> 0 or v_update_count <> 0 or v_delete_count <> 0 then
    raise exception
      'price_rules_audit porte encore un grant INSERT/UPDATE/DELETE pour authenticated/anon (% / % / %)',
      v_insert_count, v_update_count, v_delete_count;
  end if;
end;
$$;

-- Aucune ligne bloquee ci-dessus n a ete modifiee.
do $$
declare
  v_still_active boolean;
begin
  select is_active into v_still_active
    from public.price_rules where name = 'Client + gamme OK';
  if v_still_active is not true then
    raise exception 'La regle du tenant A a ete desactivee malgre le blocage RLS attendu';
  end if;
end;
$$;

rollback;
