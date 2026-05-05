-- =============================================================================
-- Migration E9.3 / v4 — Droits granulaires : scope + permissions par membership
-- -----------------------------------------------------------------------------
-- Ajoute aux memberships et aux invitations :
--   * access_scope     : 'magrit_full' (acces dashboard complet)
--                       | 'shop_only'   (acces uniquement a une boutique)
--   * allowed_shop_ids : liste de boutiques accessibles si scope='shop_only'
--   * permissions      : booleans fins {can_quote, can_order, can_invite}
--
-- Cas typique 'shop_only' : un acheteur chez un client B2B externe a qui on
-- donne acces uniquement a SA boutique pour passer commande, sans voir le
-- dashboard interne de l'imprimeur.
--
-- L'application du scope est double :
--   - cote client : guard React qui redirige vers /shop/:slug si scope=shop_only
--   - cote DB : helper current_user_can_access_shop() utilisable dans les RLS
-- =============================================================================

-- ─── 1. Colonnes sur tenant_members ────────────────────────────────────────
alter table public.tenant_members
  add column if not exists access_scope text not null default 'magrit_full'
    check (access_scope in ('magrit_full', 'shop_only'));

alter table public.tenant_members
  add column if not exists allowed_shop_ids uuid[] not null default '{}';

alter table public.tenant_members
  add column if not exists permissions jsonb not null default
    '{"can_quote": true, "can_order": true, "can_invite": false}'::jsonb;

-- ─── 2. Colonnes sur tenant_invitations (memes droits a l'acceptation) ─────
alter table public.tenant_invitations
  add column if not exists access_scope text not null default 'magrit_full'
    check (access_scope in ('magrit_full', 'shop_only'));

alter table public.tenant_invitations
  add column if not exists allowed_shop_ids uuid[] not null default '{}';

alter table public.tenant_invitations
  add column if not exists permissions jsonb not null default
    '{"can_quote": true, "can_order": true, "can_invite": false}'::jsonb;

-- ─── 3. Helper RLS : un user peut-il acceder a une boutique donnee ? ───────
-- Reutilisable dans les policies RLS de shops, shop_orders, etc.
create or replace function public.current_user_can_access_shop(p_shop_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then true
    else exists (
      select 1
      from public.tenant_members tm
      join public.shops s on s.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid()
        and s.id = p_shop_id
        and (
          tm.access_scope = 'magrit_full'
          or (tm.access_scope = 'shop_only' and p_shop_id = any(tm.allowed_shop_ids))
        )
    )
  end;
$$;

grant execute on function public.current_user_can_access_shop(uuid) to authenticated;

-- ─── 4. Update accept_tenant_invitation pour propager scope/permissions ────
create or replace function public.accept_tenant_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _inv record;
  _caller uuid := auth.uid();
begin
  if _caller is null then
    raise exception 'Authentification requise.';
  end if;

  select * into _inv from public.tenant_invitations
  where token = p_token and accepted_at is null;

  if _inv is null then
    raise exception 'Invitation invalide ou deja acceptee.';
  end if;
  if _inv.expires_at < now() then
    raise exception 'Invitation expiree.';
  end if;

  insert into public.tenant_members (
    tenant_id, user_id, role, invited_by,
    access_scope, allowed_shop_ids, permissions
  )
  values (
    _inv.tenant_id, _caller, _inv.role, _inv.invited_by,
    _inv.access_scope, _inv.allowed_shop_ids, _inv.permissions
  )
  on conflict (tenant_id, user_id) do update set
    role             = excluded.role,
    access_scope     = excluded.access_scope,
    allowed_shop_ids = excluded.allowed_shop_ids,
    permissions      = excluded.permissions;

  update public.tenant_invitations
  set accepted_at = now()
  where id = _inv.id;

  return _inv.tenant_id;
end;
$$;

-- ─── 5. Refonte get_tenant_members_with_email avec les nouvelles colonnes ──
-- DROP requis car la signature change (ajout de colonnes au returns table).
drop function if exists public.get_tenant_members_with_email(uuid);

create or replace function public.get_tenant_members_with_email(p_tenant_id uuid)
returns table (
  user_id          uuid,
  email            text,
  role             text,
  joined_at        timestamptz,
  access_scope     text,
  allowed_shop_ids uuid[],
  permissions      jsonb
)
language sql stable security definer set search_path = public, auth as $$
  select tm.user_id, u.email::text, tm.role, tm.joined_at,
         tm.access_scope, tm.allowed_shop_ids, tm.permissions
  from public.tenant_members tm
  join auth.users u on u.id = tm.user_id
  where tm.tenant_id = p_tenant_id
    and (
      public.is_super_admin()
      or p_tenant_id in (select public.current_user_tenant_ids())
    )
  order by tm.joined_at asc;
$$;

grant execute on function public.get_tenant_members_with_email(uuid) to authenticated;

notify pgrst, 'reload schema';
