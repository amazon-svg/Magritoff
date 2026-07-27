-- S7.11 (Epic 7 gabarit boutique v2) — ADR §4.20 ADR-CHECKOUT-1.
-- 1) shops.access_mode : invite_only (défaut, statu quo) | self_signup.
-- 2) RPC self_register_shop_buyer : auto-inscription légère d'un acheteur
--    sur une boutique OUVERTE — allow-list stricte scope shop_only
--    (lesson 2026-05-27 : jamais d'élargissement par exclusion).

-- ── 1. Colonne access_mode ──────────────────────────────────────────────────
alter table public.shops
  add column if not exists access_mode text not null default 'invite_only';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shops_access_mode_check'
  ) then
    alter table public.shops
      add constraint shops_access_mode_check
      check (access_mode in ('invite_only', 'self_signup'));
  end if;
end $$;

comment on column public.shops.access_mode is
  'ADR 4.20 : invite_only = acheteurs invités par l admin (défaut) ; self_signup = auto-inscription légère au checkout (boutique publique).';

-- ── 2. RPC self_register_shop_buyer ─────────────────────────────────────────
create or replace function public.self_register_shop_buyer(p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_shop record;
  v_existing record;
  v_role_def_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select id, tenant_id, active, access_mode
    into v_shop
    from public.shops
   where id = p_shop_id;

  if v_shop.id is null then
    raise exception 'shop_not_found';
  end if;
  if not v_shop.active or v_shop.access_mode <> 'self_signup' then
    -- Boutique privée ou inactive : cette voie n'existe pas (ADR 4.20-5).
    raise exception 'shop_not_open';
  end if;
  if v_shop.tenant_id is null then
    raise exception 'shop_misconfigured';
  end if;

  -- Idempotence : déjà membre du tenant → garantir l'accès à CETTE boutique
  -- (sans jamais élargir le scope existant).
  select tenant_id, user_id, access_scope, allowed_shop_ids
    into v_existing
    from public.tenant_members
   where tenant_id = v_shop.tenant_id
     and user_id = v_user_id;

  if v_existing.user_id is not null then
    if v_existing.access_scope = 'shop_only'
       and not (p_shop_id = any(coalesce(v_existing.allowed_shop_ids, '{}'))) then
      update public.tenant_members
         set allowed_shop_ids = array_append(coalesce(allowed_shop_ids, '{}'), p_shop_id)
       where tenant_id = v_shop.tenant_id
         and user_id = v_user_id;
    end if;
    v_result := jsonb_build_object('status', 'already_member');
  else
    -- Allow-list stricte : member + shop_only + cette seule boutique.
    insert into public.tenant_members
      (tenant_id, user_id, role, invited_by, access_scope, allowed_shop_ids, permissions)
    values
      (v_shop.tenant_id, v_user_id, 'member', v_user_id, 'shop_only',
       array[p_shop_id],
       jsonb_build_object('can_order', true, 'can_quote', true, 'can_invite', false));
    v_result := jsonb_build_object('status', 'registered');
  end if;

  -- Preset « Acheteur » du tenant (best-effort : absent → on n'échoue pas,
  -- les permissions membres suffisent pour commander).
  select id into v_role_def_id
    from public.tenant_role_definitions
   where tenant_id = v_shop.tenant_id
     and name = 'Acheteur'
   limit 1;

  if v_role_def_id is not null then
    insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
    select v_role_def_id, v_user_id, v_user_id
    where not exists (
      select 1 from public.tenant_role_assignments
       where role_definition_id = v_role_def_id
         and user_id = v_user_id
         and revoked_at is null
    );
    v_result := v_result || jsonb_build_object('role_assigned', true);
  end if;

  return v_result;
end;
$$;

revoke all on function public.self_register_shop_buyer(uuid) from public;
revoke all on function public.self_register_shop_buyer(uuid) from anon;
grant execute on function public.self_register_shop_buyer(uuid) to authenticated;

comment on function public.self_register_shop_buyer(uuid) is
  'ADR 4.20 : auto-inscription acheteur sur boutique self_signup. Allow-list stricte shop_only + preset Acheteur. Idempotente.';
