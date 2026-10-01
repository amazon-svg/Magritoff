create function magrit.get_subtenant_dashboard(requested_parent_tenant_id uuid)
returns table (
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  created_at timestamptz,
  member_count bigint,
  month_order_count bigint,
  month_ca_ht numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, magrit
as $$
begin
  if not (
    exists (
      select 1 from public.user_preferences preference
       where preference.user_id = magrit.current_user_id()
         and preference.is_admin
    )
    or exists (
      select 1 from public.tenant_members member
       where member.tenant_id = requested_parent_tenant_id
         and member.user_id = magrit.current_user_id()
         and member.role in ('owner','admin')
    )
  ) then
    raise exception 'subtenant_dashboard_permission_denied' using errcode = '42501';
  end if;

  return query
  select child.id,
         child.name::text,
         child.slug::text,
         child.created_at,
         (select count(*) from public.tenant_members member where member.tenant_id = child.id),
         (select count(*) from public.tenant_orders orders
           where orders.tenant_id = child.id
             and orders.created_at >= date_trunc('month', now())),
         (select coalesce(sum(orders.total_ht), 0) from public.tenant_orders orders
           where orders.tenant_id = child.id
             and orders.created_at >= date_trunc('month', now()))
    from public.tenants child
   where child.parent_tenant_id = requested_parent_tenant_id
   order by child.name,child.id;
end
$$;

revoke all on function magrit.get_subtenant_dashboard(uuid) from public;
grant execute on function magrit.get_subtenant_dashboard(uuid) to magrit_api;

comment on function magrit.get_subtenant_dashboard(uuid) is
  'Tableau consolide des sous-espaces, borne aux administrateurs du tenant parent.';
