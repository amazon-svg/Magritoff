begin;

do $$
declare
  v_legacy_user uuid;
  v_tenant uuid;
  v_shop_a uuid;
  v_shop_b uuid;
  v_existing_account uuid;
  v_account_a uuid;
  v_account_b uuid;
  v_order_a uuid;
  v_order_b uuid;
  v_role uuid;
  v_report_count integer;
  v_result jsonb;
begin
  select id into v_legacy_user from auth.users where email is not null order by created_at limit 1;
  if v_legacy_user is null then raise exception 'Utilisateur Auth requis pour le scénario UM7.1'; end if;

  insert into public.tenants (slug, name)
  values ('um7-legacy-migration', 'UM7 Legacy Migration') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_legacy_user, v_tenant, 'um7-legacy-a', 'UM7 Shop A') returning id into v_shop_a;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_legacy_user, v_tenant, 'um7-legacy-b', 'UM7 Shop B') returning id into v_shop_b;

  perform set_config('magrit.allow_legacy_shop_only_write', 'on', true);
  insert into public.tenant_members (
    tenant_id, user_id, role, access_scope, allowed_shop_ids
  ) values (
    v_tenant, v_legacy_user, 'member', 'shop_only', array[v_shop_a, v_shop_b]
  );
  perform set_config('magrit.allow_legacy_shop_only_write', 'off', true);

  insert into public.shop_customer_accounts (shop_id, email, full_name, status)
  select v_shop_b, u.email, 'Compte déjà présent', 'delegated_only'
    from auth.users u where u.id = v_legacy_user
  returning id into v_existing_account;

  insert into public.tenant_orders (tenant_id, shop_id, created_by, total_ht)
  values (v_tenant, v_shop_a, v_legacy_user, 10) returning id into v_order_a;
  insert into public.tenant_orders (tenant_id, shop_id, created_by, total_ht)
  values (v_tenant, v_shop_b, v_legacy_user, 20) returning id into v_order_b;

  if (select count(*) from private.legacy_shop_customer_migration_plan
      where legacy_tenant_id = v_tenant and proposed_action = 'create_delegated') <> 1 then
    raise exception 'Le plan UM7.1 ne détecte pas le compte à créer';
  end if;
  if (select count(*) from private.legacy_shop_customer_migration_plan
      where legacy_tenant_id = v_tenant and proposed_action = 'matched_existing') <> 1 then
    raise exception 'Le plan UM7.1 ne détecte pas la collision à réutiliser';
  end if;

  select private.migrate_legacy_shop_customers(v_tenant) into v_result;
  if (v_result->>'created')::integer <> 1
     or (v_result->>'matched_existing')::integer <> 1
     or (v_result->>'orders_linked')::integer <> 2 then
    raise exception 'Résultat UM7.1 inattendu : %', v_result;
  end if;

  select id into v_account_a from public.shop_customer_accounts
   where shop_id = v_shop_a;
  select id into v_account_b from public.shop_customer_accounts
   where shop_id = v_shop_b;
  if v_account_a is null or v_account_b <> v_existing_account or v_account_a = v_account_b then
    raise exception 'Isolation ou réutilisation des comptes UM7.1 incorrecte';
  end if;
  if exists (
    select 1 from public.shop_customer_accounts
     where id in (v_account_a, v_account_b) and auth_subject_id is not null
  ) then
    raise exception 'Une identité Auth legacy a été partagée avec un compte boutique';
  end if;
  if (select shop_customer_account_id from public.tenant_orders where id = v_order_a) <> v_account_a
     or (select shop_customer_account_id from public.tenant_orders where id = v_order_b) <> v_account_b then
    raise exception 'Commandes historiques UM7.1 non rattachées';
  end if;
  if not exists (
    select 1 from public.tenant_members
     where tenant_id = v_tenant and user_id = v_legacy_user and access_scope = 'shop_only'
  ) then
    raise exception 'Le membre legacy a été supprimé prématurément';
  end if;
  if (select count(*) from private.legacy_shop_customer_migrations
      where legacy_tenant_id = v_tenant) <> 2 then
    raise exception 'Audit UM7.1 incomplet';
  end if;

  insert into public.tenant_role_definitions (tenant_id, name, capabilities, created_by)
  values (v_tenant, 'UM7 Migration Auditor', '{"can_manage_shop_customers":true}'::jsonb, v_legacy_user)
  returning id into v_role;
  insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
  values (v_role, v_legacy_user, v_legacy_user);
  perform set_config('request.jwt.claim.sub', v_legacy_user::text, true);
  select count(*) into v_report_count
    from public.api_get_legacy_shop_customer_migration_report(v_tenant);
  if v_report_count <> 2 then
    raise exception 'Rapport API UM7.1 incomplet : % lignes', v_report_count;
  end if;

  select private.migrate_legacy_shop_customers(v_tenant) into v_result;
  if (v_result->>'created')::integer <> 0
     or (v_result->>'matched_existing')::integer <> 2
     or (v_result->>'orders_linked')::integer <> 0 then
    raise exception 'Migration UM7.1 non idempotente : %', v_result;
  end if;
  if (select count(*) from private.legacy_shop_customer_migrations
      where legacy_tenant_id = v_tenant) <> 2 then
    raise exception 'Audit UM7.1 dupliqué au rejeu';
  end if;
end;
$$;

rollback;
