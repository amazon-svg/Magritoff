create policy tenant_order_status_definitions_storefront_read
  on public.tenant_order_status_definitions for select to magrit_api using (
    tenant_id=magrit.current_tenant_id()
    and magrit.current_storefront_account_id() is not null
  );

create policy tenant_order_status_transitions_storefront_read
  on public.tenant_order_status_transitions for select to magrit_api using (
    tenant_id=magrit.current_tenant_id()
    and magrit.current_storefront_account_id() is not null
  );

create policy shop_customer_accounts_storefront_self_read
  on public.shop_customer_accounts for select to magrit_api using (
    id=magrit.current_storefront_account_id()
  );

comment on policy tenant_order_status_transitions_storefront_read
  on public.tenant_order_status_transitions is
  'Expose uniquement la matrice du tenant de la session storefront verifiee par le BFF.';
