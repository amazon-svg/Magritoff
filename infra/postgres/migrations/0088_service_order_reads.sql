-- Les lectures communes des commandes sont accessibles aux clés de service
-- possédant `orders:read`. La façade authentifie le scope puis marque la
-- transaction ; PostgreSQL conserve le cloisonnement strict par tenant.

create or replace function magrit.current_actor_kind()
returns text language sql stable as $$
  select nullif(current_setting('magrit.actor_kind',true),'')
$$;

revoke all on function magrit.current_actor_kind() from public;
grant execute on function magrit.current_actor_kind() to magrit_api;

create policy tenant_orders_service_read on public.tenant_orders
  for select to magrit_api using (
    magrit.current_actor_kind()='service'
    and tenant_id=magrit.current_tenant_id()
  );

-- Le nom et le courriel d'un acheteur boutique font partie de la projection
-- de liste et de détail. Cette lecture reste bornée au même tenant technique.
create policy shop_customer_accounts_service_read on public.shop_customer_accounts
  for select to magrit_api using (
    magrit.current_actor_kind()='service'
    and tenant_id=magrit.current_tenant_id()
  );
