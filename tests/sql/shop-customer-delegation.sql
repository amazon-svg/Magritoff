begin;

do $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_shop uuid;
  v_role uuid;
  v_first record;
  v_second record;
  v_resolved record;
  v_revoked boolean;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour le scénario UM5'; end if;

  insert into public.tenants (slug, name)
  values ('um5-delegation-test', 'UM5 Delegation Test') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um5-delegation-shop', 'UM5 Shop') returning id into v_shop;
  insert into public.tenant_role_definitions (tenant_id, name, capabilities, created_by)
  values (v_tenant, 'UM5 Delegator', '{"can_impersonate_shop_customer":true}'::jsonb, v_actor)
  returning id into v_role;
  insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
  values (v_role, v_actor, v_actor);

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  select * into v_first from public.api_start_self_shop_customer_delegation(
    v_tenant, v_shop, 'Premier accès', 1800
  );
  if v_first.opaque_token is null or v_first.actor_magrit_user_id <> v_actor then
    raise exception 'Première délégation UM5 invalide';
  end if;

  select * into v_resolved from public.api_resolve_shop_customer_session(v_first.opaque_token);
  if v_resolved.session_kind <> 'delegated' or v_resolved.delegation_id <> v_first.delegation_id then
    raise exception 'Session déléguée UM5 irrésoluble';
  end if;

  select * into v_second from public.api_start_self_shop_customer_delegation(
    v_tenant, v_shop, 'Second accès', 1800
  );
  select * into v_resolved from public.api_resolve_shop_customer_session(v_first.opaque_token);
  if v_resolved.account_id is not null then raise exception 'Ancienne session UM5 encore active'; end if;

  select public.api_revoke_shop_customer_session(v_second.opaque_token) into v_revoked;
  if not v_revoked then raise exception 'Révocation UM5 refusée'; end if;
  if not exists (
    select 1 from private.shop_customer_delegations
    where id = v_second.delegation_id and revoked_at is not null
  ) then raise exception 'Audit de fin de délégation UM5 absent'; end if;
end;
$$;

rollback;
