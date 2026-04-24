-- =============================================================================
-- Migration 05 / v3 — Bootstrap du tenant systeme "magrit-root"
-- -----------------------------------------------------------------------------
-- Cree le tenant special Magrit, et expose deux fonctions RPC que le
-- frontend appelle a l'onboarding :
--
--   * bootstrap_magrit_admin(user_id) — appelee par un script one-shot pour
--     promouvoir un user existant au rang de superadmin Magrit (membership
--     dans le tenant magrit-root avec role 'owner').
--
--   * create_tenant_with_owner(slug, name, parent_tenant_id) — appelee par
--     le frontend apres signup pour creer un tenant et s'y ajouter comme
--     owner dans la meme transaction. Evite le probleme classique "je cree
--     un tenant mais la RLS sur tenant_members refuse mon insert car je ne
--     suis pas encore membre".
-- =============================================================================

-- ─── Tenant systeme Magrit ────────────────────────────────────────────────
insert into public.tenants (slug, name, is_system_tenant, plan)
values ('magrit-root', 'Magrit', true, 'enterprise')
on conflict (slug) do nothing;

-- ─── RPC : bootstrap superadmin ───────────────────────────────────────────
-- A appeler une seule fois pour promouvoir Arnaud en superadmin.
-- Usage SQL editor apres creation du compte :
--   select public.bootstrap_magrit_admin('<user-uuid>');
create or replace function public.bootstrap_magrit_admin(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare _root_id uuid;
begin
  select id into _root_id from public.tenants where slug = 'magrit-root';
  if _root_id is null then
    raise exception 'Tenant magrit-root non trouve. Deployer la migration 05 d''abord.';
  end if;
  insert into public.tenant_members (tenant_id, user_id, role)
  values (_root_id, p_user_id, 'owner')
  on conflict (tenant_id, user_id) do update set role = 'owner';
end;
$$;

-- ─── RPC : creation tenant + owner membership atomique ────────────────────
-- Appelee par le frontend lors du signup ou de la creation d'un tenant.
-- Retourne l'id du tenant cree.
create or replace function public.create_tenant_with_owner(
  p_slug text,
  p_name text,
  p_parent_tenant_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _tenant_id uuid;
  _caller uuid := auth.uid();
begin
  if _caller is null then
    raise exception 'Authentification requise pour creer un tenant.';
  end if;

  -- Si parent_tenant_id fourni : l'user doit etre owner/admin du parent.
  if p_parent_tenant_id is not null then
    if public.user_role_in_tenant(p_parent_tenant_id) not in ('owner', 'admin')
       and not public.is_super_admin() then
      raise exception 'Droits insuffisants sur le tenant parent.';
    end if;
  end if;

  -- Creation du tenant
  insert into public.tenants (slug, name, parent_tenant_id)
  values (p_slug, p_name, p_parent_tenant_id)
  returning id into _tenant_id;

  -- Ajout du caller comme owner
  insert into public.tenant_members (tenant_id, user_id, role)
  values (_tenant_id, _caller, 'owner');

  -- Met a jour last_tenant_id pour l'user (quality of life)
  insert into public.user_preferences (user_id, last_tenant_id)
  values (_caller, _tenant_id)
  on conflict (user_id) do update set last_tenant_id = excluded.last_tenant_id;

  return _tenant_id;
end;
$$;

-- ─── RPC : accept invitation ──────────────────────────────────────────────
-- L'utilisateur invite appelle cette fonction avec le token recu par email.
-- Elle verifie le token, cree le membership, et marque l'invitation acceptee.
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

  insert into public.tenant_members (tenant_id, user_id, role, invited_by)
  values (_inv.tenant_id, _caller, _inv.role, _inv.invited_by)
  on conflict (tenant_id, user_id) do update set role = excluded.role;

  update public.tenant_invitations
  set accepted_at = now()
  where id = _inv.id;

  return _inv.tenant_id;
end;
$$;

-- ─── Grants : ces RPC sont callables par tout user authentifie ────────────
grant execute on function public.create_tenant_with_owner(text, text, uuid) to authenticated;
grant execute on function public.accept_tenant_invitation(text) to authenticated;
-- bootstrap_magrit_admin : volontairement PAS granted to authenticated. Doit
-- etre appele via service_role / SQL editor pour des raisons de securite.
