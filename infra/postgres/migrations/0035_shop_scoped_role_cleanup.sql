create function magrit.remove_shop_scoped_roles(
  requested_tenant_id uuid,
  requested_shop_id uuid
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,magrit
as $$
begin
  if requested_tenant_id is distinct from magrit.current_tenant_id()
     or not magrit.actor_has_capability(requested_tenant_id,'can_manage_shops') then
    raise exception using errcode='42501',message='permission_denied: can_manage_shops';
  end if;
  if not exists (
    select 1 from public.shops
     where id=requested_shop_id and tenant_id=requested_tenant_id and deleted_at is null
  ) then
    raise exception using errcode='P0002',message='shop_not_found';
  end if;
  delete from public.tenant_role_assignments
   where role_definition_id in (
     select id from public.tenant_role_definitions
      where tenant_id=requested_tenant_id and scope_shop_id=requested_shop_id
   );
  delete from public.tenant_role_definitions
   where tenant_id=requested_tenant_id and scope_shop_id=requested_shop_id;
end
$$;

revoke all on function magrit.remove_shop_scoped_roles(uuid,uuid) from public;
grant execute on function magrit.remove_shop_scoped_roles(uuid,uuid) to magrit_api;

comment on function magrit.remove_shop_scoped_roles(uuid,uuid) is
  'Nettoie les roles limites a une boutique lors de sa suppression, apres controle can_manage_shops.';
