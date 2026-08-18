begin;

create temporary table um10_tax_context (
  active_slug text not null,
  inactive_slug text not null
);
grant select on um10_tax_context to anon;

do $$
declare
  v_actor uuid;
  v_tenant uuid;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour le scénario UM10.2'; end if;

  insert into public.tenants (slug, name, tax_regime)
  values ('um10-storefront-tax', 'UM10 Storefront Tax', 'dom_tom')
  returning id into v_tenant;

  insert into public.shops (owner_user_id, tenant_id, slug, name, active)
  values
    (v_actor, v_tenant, 'um10-storefront-tax-active', 'UM10 Active', true),
    (v_actor, v_tenant, 'um10-storefront-tax-inactive', 'UM10 Inactive', false);

  insert into um10_tax_context values (
    'um10-storefront-tax-active', 'um10-storefront-tax-inactive'
  );

  if not has_function_privilege(
    'anon', 'public.api_get_public_shop_tax_regime(text)', 'EXECUTE'
  ) then
    raise exception 'Le rôle anon ne peut pas lire la politique fiscale boutique';
  end if;
end;
$$;

set local role anon;

do $$
declare
  v_regime text;
begin
  select public.api_get_public_shop_tax_regime(
    (select active_slug from um10_tax_context)
  ) into v_regime;
  if v_regime <> 'dom_tom' then
    raise exception 'Régime fiscal UM10.2 incorrect : %', v_regime;
  end if;

  begin
    perform public.api_get_public_shop_tax_regime(
      (select inactive_slug from um10_tax_context)
    );
    raise exception 'Une boutique inactive expose sa politique fiscale';
  exception
    when others then
      if sqlerrm not like '%shop_not_found%' then raise; end if;
  end;
end;
$$;

reset role;
rollback;
