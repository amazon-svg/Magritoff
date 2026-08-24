-- UM1 — garanties serveur des profils Magrit et de l'option Boutiques.

-- La vérification applicative améliore le message d'erreur, mais ce trigger
-- constitue la garantie transactionnelle contre la suppression/rétrogradation
-- concurrente du dernier administrateur.
create or replace function public.protect_last_tenant_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- La suppression explicite du tenant possède sa propre autorisation et doit
  -- pouvoir cascader ses memberships.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if old.role <> 'admin'
     or (tg_op = 'UPDATE' and new.role = 'admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(old.tenant_id::text, 0));
  if not exists (
    select 1
      from public.tenant_members member
     where member.tenant_id = old.tenant_id
       and member.user_id <> old.user_id
       and member.role = 'admin'
  ) then
    raise exception using
      errcode = '23514',
      message = 'last_admin_protected';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists tenant_members_protect_last_admin on public.tenant_members;
create trigger tenant_members_protect_last_admin
before delete or update of role on public.tenant_members
for each row execute function public.protect_last_tenant_admin();

-- Le modèle d'affectation Magrit ne reçoit plus de rôles de catalogue : les
-- seules affectations valides sont les deux options produit.
create or replace function public.restrict_magrit_assignments_to_options()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
      from public.tenant_role_definitions definition
      join public.tenant_members member
        on member.tenant_id = definition.tenant_id
       and member.user_id = new.user_id
     where definition.id = new.role_definition_id
       and member.access_scope = 'magrit_full'
       and definition.system_key is distinct from 'option_shops'
       and definition.system_key is distinct from 'option_orders'
  ) then
    raise exception using errcode = '23514', message = 'magrit_option_required';
  end if;
  return new;
end;
$$;

drop trigger if exists tenant_role_assignments_only_options on public.tenant_role_assignments;
create trigger tenant_role_assignments_only_options
before insert or update of role_definition_id, user_id on public.tenant_role_assignments
for each row execute function public.restrict_magrit_assignments_to_options();

-- Un admin gère toutes les boutiques du tenant. Un utilisateur portant
-- option_shops ne gère que celles qu'il a lui-même créées.
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
           and (
             member.role = 'admin'
             or (
               shop.owner_user_id = auth.uid()
               and public.user_has_capability(shop.tenant_id, 'can_manage_shops')
             )
           )
      );
$$;

grant execute on function public.can_manage_shop(uuid) to authenticated;

drop policy if exists "shops owner all" on public.shops;
drop policy if exists "shops_write" on public.shops;
drop policy if exists "shops_insert" on public.shops;
drop policy if exists "shops_update" on public.shops;
drop policy if exists "shops_delete" on public.shops;
create policy "shops_insert" on public.shops
for insert
with check (
  public.user_has_capability(tenant_id, 'can_manage_shops')
  and owner_user_id = auth.uid()
);
create policy "shops_update" on public.shops
for update
using (public.can_manage_shop(id))
with check (public.can_manage_shop(id));
create policy "shops_delete" on public.shops
for delete
using (public.can_manage_shop(id));

-- Empêche également de déplacer une boutique vers un autre tenant ou un autre
-- propriétaire en contournant les contrats HTTP.
create or replace function public.keep_shop_ownership_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.owner_user_id is distinct from old.owner_user_id then
    raise exception using errcode = '23514', message = 'shop_ownership_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists shops_keep_ownership_immutable on public.shops;
create trigger shops_keep_ownership_immutable
before update on public.shops
for each row execute function public.keep_shop_ownership_immutable();

drop policy if exists "shop_products owner all" on public.shop_products;
drop policy if exists "shop_products_write" on public.shop_products;
create policy "shop_products_write" on public.shop_products
for all
using (public.can_manage_shop(shop_id))
with check (public.can_manage_shop(shop_id));

notify pgrst, 'reload schema';
