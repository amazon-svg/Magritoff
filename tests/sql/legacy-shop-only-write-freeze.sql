begin;

create temporary table um8_write_freeze_context (
  actor_id uuid not null,
  tenant_id uuid not null,
  shop_id uuid not null
);

grant select on um8_write_freeze_context to authenticated;

do $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_shop uuid;
  v_role uuid;
begin
  select id into v_actor
    from auth.users
   where email is not null
   order by created_at
   limit 1;
  if v_actor is null then
    raise exception 'Utilisateur Auth requis pour le scénario UM8.1';
  end if;

  insert into public.tenants (slug, name)
  values ('um8-shop-only-freeze', 'UM8 Shop-only Freeze')
  returning id into v_tenant;

  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um8-shop-only-freeze', 'UM8 Shop')
  returning id into v_shop;

  insert into public.tenant_members (
    tenant_id, user_id, role, access_scope, allowed_shop_ids
  ) values (
    v_tenant, v_actor, 'owner', 'magrit_full', '{}'
  );

  insert into public.tenant_role_definitions (
    tenant_id, name, capabilities, created_by
  ) values (
    v_tenant,
    'UM8 Invitation Manager',
    '{"can_invite":true}'::jsonb,
    v_actor
  ) returning id into v_role;

  insert into public.tenant_role_assignments (
    role_definition_id, user_id, assigned_by
  ) values (v_role, v_actor, v_actor);

  insert into um8_write_freeze_context (actor_id, tenant_id, shop_id)
  values (v_actor, v_tenant, v_shop);
end;
$$;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select actor_id::text from um8_write_freeze_context),
  true
);

do $$
declare
  v_tenant uuid;
  v_shop uuid;
  v_rejected boolean := false;
begin
  select tenant_id, shop_id into v_tenant, v_shop
    from um8_write_freeze_context;

  begin
    perform public.api_create_tenant_invitation(
      v_tenant,
      'um8-shop-only@example.test',
      'shop_only',
      array[v_shop],
      '{}'
    );
  exception
    when others then
      if sqlerrm not like 'legacy_shop_only_frozen:%' then
        raise exception 'Refus UM8.1 inattendu : %', sqlerrm;
      end if;
      v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'Une session applicative a encore créé une invitation shop_only';
  end if;

  perform public.api_create_tenant_invitation(
    v_tenant,
    'um8-magrit@example.test',
    'magrit_full',
    '{}',
    '{}'
  );

  if not exists (
    select 1
      from public.tenant_invitations
     where tenant_id = v_tenant
       and email = 'um8-magrit@example.test'
       and access_scope = 'magrit_full'
  ) then
    raise exception 'L''invitation Magrit autorisée n''a pas été créée';
  end if;
end;
$$;

reset role;

rollback;
