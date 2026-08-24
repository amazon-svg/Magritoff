-- UM1 — cycle de vie d'une boutique.
-- La ligne boutique est conservée comme ancre technique des commandes ayant
-- atteint la validation ; elle est masquée de toutes les surfaces produit.

alter table public.shops
  add column if not exists deleted_at timestamptz;

create index if not exists shops_tenant_not_deleted_idx
  on public.shops (tenant_id, created_at desc)
  where deleted_at is null;

create or replace function public.api_delete_shop(
  p_tenant_id uuid,
  p_shop_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_shop public.shops%rowtype;
begin
  select * into v_shop
    from public.shops
   where id = p_shop_id
     and tenant_id = p_tenant_id
     and deleted_at is null
   for update;

  if not found then
    return false;
  end if;
  if not public.can_manage_shop(p_shop_id) then
    raise exception using errcode = '42501', message = 'permission_denied: can_manage_shops';
  end if;

  -- Les commandes non engagées disparaissent. Validée et tous ses états
  -- suivants restent attachés à l'ancre technique de la boutique.
  delete from public.tenant_orders
   where shop_id = p_shop_id
     and status in ('draft', 'cancelled');

  delete from public.shop_orders where shop_id = p_shop_id;
  delete from public.shop_products where shop_id = p_shop_id;
  delete from public.shop_product_pricing where shop_id = p_shop_id;
  delete from public.shop_template_mockups where shop_id = p_shop_id;
  delete from public.shop_gamme_visual_preferences where shop_id = p_shop_id;
  delete from public.shop_visual_preferences where shop_id = p_shop_id;
  delete from public.tenant_role_definitions where scope_shop_id = p_shop_id;

  -- Révoque tout accès client, y compris pour les comptes minimaux conservés
  -- comme identité d'une commande validée.
  delete from private.storefront_order_command_receipts receipt
   where receipt.shop_customer_account_id in (
     select id from public.shop_customer_accounts where shop_id = p_shop_id
   );
  delete from private.shop_customer_sessions where shop_id = p_shop_id;
  delete from private.shop_customer_delegations where shop_id = p_shop_id;
  delete from private.shop_customer_credentials credential
   where credential.shop_customer_account_id in (
     select id from public.shop_customer_accounts where shop_id = p_shop_id
   );
  delete from private.shop_customer_activation_tokens token
   where token.shop_customer_account_id in (
     select id from public.shop_customer_accounts where shop_id = p_shop_id
   );
  delete from private.shop_customer_password_recovery_tokens token
   where token.shop_customer_account_id in (
     select id from public.shop_customer_accounts where shop_id = p_shop_id
   );

  delete from public.shop_customer_accounts account
   where account.shop_id = p_shop_id
     and not exists (
       select 1 from public.tenant_orders orders
        where orders.shop_customer_account_id = account.id
     );
  update public.shop_customer_accounts
     set status = 'suspended', suspended_at = coalesce(suspended_at, now())
   where shop_id = p_shop_id;

  update public.shops
     set active = false,
         deleted_at = now(),
         name = '[Boutique supprimée]',
         description = '',
         logo_url = '',
         address = '',
         contact_email = '',
         hero_image_url = null,
         tagline = null,
         library_ids = '{}',
         excluded_product_ids = '{}',
         pim_catalog_mode = false,
         pim_gamme_slugs = '{}'
   where id = p_shop_id;

  return true;
end;
$$;

grant execute on function public.api_delete_shop(uuid, uuid) to authenticated;

-- Une ligne supprimée n'est plus une boutique administrable ni publique.
create or replace function public.can_manage_shop(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
      or exists (
        select 1
          from public.shops shop
          join public.tenant_members member
            on member.tenant_id = shop.tenant_id
           and member.user_id = auth.uid()
           and member.access_scope = 'magrit_full'
         where shop.id = p_shop_id
           and shop.deleted_at is null
           and (
             member.role = 'admin'
             or (
               shop.owner_user_id = auth.uid()
               and public.user_has_capability(shop.tenant_id, 'can_manage_shops')
             )
           )
      );
$$;

drop policy if exists "shops_public_read" on public.shops;
drop policy if exists "shops public select" on public.shops;
create policy "shops_public_read" on public.shops
for select using (active = true and deleted_at is null);

notify pgrst, 'reload schema';
