-- UM4.1 — Compte boutique miroir idempotent pour l'utilisateur Magrit courant.

create or replace function public.api_ensure_self_shop_customer(
  p_tenant_id uuid,
  p_shop_id uuid
)
returns table (
  account_id uuid,
  shop_id uuid,
  email text,
  normalized_email text,
  full_name text,
  auth_subject_id uuid,
  status text,
  created_by_magrit_user_id uuid,
  created_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  created boolean
)
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_name text;
  v_created boolean := false;
begin
  if v_actor is null
    or not exists (
      select 1 from public.shops s
      where s.id = p_shop_id and s.tenant_id = p_tenant_id
        and public.user_has_capability(p_tenant_id, 'can_impersonate_shop_customer')
    ) then
    return;
  end if;

  select lower(btrim(u.email)), left(btrim(coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    split_part(u.email, '@', 1)
  )), 200)
  into v_email, v_name
  from auth.users u where u.id = v_actor;

  if v_email is null or length(v_email) not between 3 and 320
    or position('@' in v_email) <= 1 or v_name is null or v_name = '' then
    return;
  end if;

  insert into public.shop_customer_accounts (
    shop_id, email, full_name, status, created_by_magrit_user_id
  ) values (
    p_shop_id, v_email, v_name, 'delegated_only', v_actor
  )
  on conflict on constraint shop_customer_accounts_shop_email_unique do nothing;
  v_created := found;

  return query
  select a.id, a.shop_id, a.email, a.normalized_email, a.full_name,
    a.auth_subject_id, a.status, a.created_by_magrit_user_id, a.created_at,
    a.activated_at, a.suspended_at, v_created
  from public.shop_customer_accounts a
  where a.shop_id = p_shop_id and a.normalized_email = v_email;
end;
$$;

revoke all on function public.api_ensure_self_shop_customer(uuid, uuid) from public, anon;
grant execute on function public.api_ensure_self_shop_customer(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
