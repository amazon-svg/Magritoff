-- UM1 — l'option Commandes est la frontière serveur du pilotage workspace.

create or replace function public.can_manage_tenant_orders(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1
          from public.tenant_members member
         where member.tenant_id = p_tenant_id
           and member.user_id = auth.uid()
           and member.access_scope = 'magrit_full'
           and (
             member.role = 'admin'
             or public.user_has_capability(p_tenant_id, 'can_validate')
           )
      );
$$;

grant execute on function public.can_manage_tenant_orders(uuid) to authenticated;

drop policy if exists tenant_orders_select on public.tenant_orders;
create policy tenant_orders_select on public.tenant_orders
for select using (public.can_manage_tenant_orders(tenant_id));

drop policy if exists tenant_orders_insert on public.tenant_orders;
create policy tenant_orders_insert on public.tenant_orders
for insert with check (
  public.can_manage_tenant_orders(tenant_id)
  and created_by = auth.uid()
);

drop policy if exists tenant_orders_update on public.tenant_orders;
create policy tenant_orders_update on public.tenant_orders
for update using (public.can_manage_tenant_orders(tenant_id))
with check (public.can_manage_tenant_orders(tenant_id));

drop policy if exists tenant_orders_delete on public.tenant_orders;
create policy tenant_orders_delete on public.tenant_orders
for delete using (public.can_manage_tenant_orders(tenant_id));

drop policy if exists tenant_order_items_select on public.tenant_order_items;
create policy tenant_order_items_select on public.tenant_order_items
for select using (
  exists (
    select 1 from public.tenant_orders orders
     where orders.id = order_id
       and public.can_manage_tenant_orders(orders.tenant_id)
  )
);

drop policy if exists tenant_order_items_insert on public.tenant_order_items;
create policy tenant_order_items_insert on public.tenant_order_items
for insert with check (
  exists (
    select 1 from public.tenant_orders orders
     where orders.id = order_id
       and public.can_manage_tenant_orders(orders.tenant_id)
  )
);

drop policy if exists tenant_order_items_update on public.tenant_order_items;
create policy tenant_order_items_update on public.tenant_order_items
for update using (
  exists (
    select 1 from public.tenant_orders orders
     where orders.id = order_id
       and public.can_manage_tenant_orders(orders.tenant_id)
  )
);

drop policy if exists tenant_order_items_delete on public.tenant_order_items;
create policy tenant_order_items_delete on public.tenant_order_items
for delete using (
  exists (
    select 1 from public.tenant_orders orders
     where orders.id = order_id
       and public.can_manage_tenant_orders(orders.tenant_id)
  )
);

drop policy if exists tenant_order_status_events_select on public.tenant_order_status_events;
create policy tenant_order_status_events_select on public.tenant_order_status_events
for select using (
  exists (
    select 1 from public.tenant_orders orders
     where orders.id = order_id
       and public.can_manage_tenant_orders(orders.tenant_id)
  )
);

-- La table historique n'accorde plus sa gestion au seul créateur de boutique.
-- L'insertion publique du checkout et la lecture client dédiée restent intactes.
drop policy if exists "shop_orders owner" on public.shop_orders;
create policy "shop_orders magrit managers" on public.shop_orders
for all
using (
  exists (
    select 1 from public.shops shop
     where shop.id = shop_id
       and public.can_manage_tenant_orders(shop.tenant_id)
  )
);

notify pgrst, 'reload schema';
