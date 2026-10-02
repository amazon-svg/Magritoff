drop policy shop_customer_accounts_write on public.shop_customer_accounts;
create policy shop_customer_accounts_insert on public.shop_customer_accounts for insert with check (
  tenant_id=magrit.current_tenant_id() and (
    magrit.actor_has_capability(tenant_id,'can_manage_shop_customers')
    or magrit.actor_has_capability(tenant_id,'can_impersonate_shop_customer')
  )
);
create policy shop_customer_accounts_update on public.shop_customer_accounts for update using (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shop_customers')
) with check (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shop_customers')
);
create policy shop_customer_accounts_delete on public.shop_customer_accounts for delete using (
  tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_shop_customers')
);
