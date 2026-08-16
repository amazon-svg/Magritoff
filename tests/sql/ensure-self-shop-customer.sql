begin;

do $$
declare
  v_tenant uuid;
  v_shop uuid;
  v_actor uuid;
  v_role uuid;
  v_first record;
  v_second record;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;

  if v_actor is null then
    raise notice 'Scénario UM4 ignoré : utilisateur Auth absent.';
    return;
  end if;

  insert into public.tenants (slug, name)
  values ('um4-self-customer-test', 'UM4 Self Customer Test') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um4-self-customer-shop', 'UM4 Shop') returning id into v_shop;
  insert into public.tenant_role_definitions (tenant_id, name, capabilities, created_by)
  values (v_tenant, 'UM4 Delegator', '{"can_impersonate_shop_customer":true}'::jsonb, v_actor)
  returning id into v_role;
  insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
  values (v_role, v_actor, v_actor);

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  select * into v_first from public.api_ensure_self_shop_customer(v_tenant, v_shop);
  select * into v_second from public.api_ensure_self_shop_customer(v_tenant, v_shop);

  if v_first.account_id is null or v_second.account_id <> v_first.account_id then
    raise exception 'La création du compte miroir n est pas idempotente.';
  end if;
  if v_second.created then
    raise exception 'Le second appel ne doit pas annoncer une création.';
  end if;
end;
$$;

rollback;
