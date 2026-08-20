-- UM1.2 — Capabilities workspace et RLS des comptes boutique.
-- Les sessions storefront restent exclues : elles passeront par le BFF UM2.

update public.tenant_role_definitions
set capabilities = capabilities || jsonb_build_object(
  'can_manage_shop_customers', true,
  'can_impersonate_shop_customer', true
)
where name in ('Owner', 'Admin')
  and archived_at is null;

create or replace function public.ensure_canonical_shop_customer_capabilities()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name in ('Owner', 'Admin') and new.archived_at is null then
    new.capabilities := coalesce(new.capabilities, '{}'::jsonb) || jsonb_build_object(
      'can_manage_shop_customers', true,
      'can_impersonate_shop_customer', true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_canonical_shop_customer_capabilities
  on public.tenant_role_definitions;
create trigger trg_canonical_shop_customer_capabilities
before insert or update of name, capabilities, archived_at
on public.tenant_role_definitions
for each row execute function public.ensure_canonical_shop_customer_capabilities();

grant select on table public.shop_customer_accounts to authenticated;
grant insert (shop_id, email, full_name, status, created_by_magrit_user_id)
  on table public.shop_customer_accounts to authenticated;
grant update (email, full_name, status, activated_at, suspended_at)
  on table public.shop_customer_accounts to authenticated;

create policy shop_customer_accounts_workspace_select
on public.shop_customer_accounts
for select
to authenticated
using (
  exists (
    select 1
    from public.shops shop
    where shop.id = shop_customer_accounts.shop_id
      and (
        public.user_has_capability(shop.tenant_id, 'can_manage_shop_customers')
        or public.user_has_capability(shop.tenant_id, 'can_impersonate_shop_customer')
      )
  )
);

create policy shop_customer_accounts_workspace_insert
on public.shop_customer_accounts
for insert
to authenticated
with check (
  created_by_magrit_user_id = auth.uid()
  and exists (
    select 1
    from public.shops shop
    where shop.id = shop_customer_accounts.shop_id
      and (
        public.user_has_capability(shop.tenant_id, 'can_manage_shop_customers')
        or public.user_has_capability(shop.tenant_id, 'can_impersonate_shop_customer')
      )
  )
);

create policy shop_customer_accounts_workspace_update
on public.shop_customer_accounts
for update
to authenticated
using (
  exists (
    select 1 from public.shops shop
    where shop.id = shop_customer_accounts.shop_id
      and public.user_has_capability(shop.tenant_id, 'can_manage_shop_customers')
  )
)
with check (
  exists (
    select 1 from public.shops shop
    where shop.id = shop_customer_accounts.shop_id
      and public.user_has_capability(shop.tenant_id, 'can_manage_shop_customers')
  )
);

notify pgrst, 'reload schema';
