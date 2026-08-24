-- ============================================================================
-- 20260814000200 — Un seul profil d administration : admin
-- ----------------------------------------------------------------------------
-- Décision Arnaud 2026-08-14 (chantier gestion des utilisateurs, matrice UM1) :
-- la distinction owner/admin ne se conserve pas. Les owners existants ne sont
-- que des exemples de démo — conversion pure et simple en admin.
--
-- Contenu :
--   1. données : owner → admin (memberships et invitations en attente) ;
--   2. contraintes : la valeur owner devient impossible à écrire ;
--   3. fonctions de création : plus aucun site n écrit owner ;
--   4. politique tenants_delete : réservée au owner, elle serait devenue
--      inaccessible à tout le monde sauf super admin — rebasculée sur admin ;
--   5. user_has_capability : le profil admin porte TOUTES les capabilities,
--      y compris can_manage_roles (il n y a plus d owner au-dessus de lui).
--
-- Les politiques qui testent role in ('owner','admin') ailleurs restent
-- valides telles quelles : la branche owner ne matche simplement plus rien.
-- Leur nettoyage lexical se fera au fil des retouches de chaque domaine.
--
-- La protection « le dernier moyen d administrer ne peut pas disparaître »
-- (spec access-management, règle 7) est portée par l API membres côté
-- serveur : le dernier admin d un tenant ne peut être ni rétrogradé ni retiré.
--
-- Idempotente.
-- ============================================================================

-- ─── 1. Données ──────────────────────────────────────────────────────────────

update public.tenant_members set role = 'admin' where role = 'owner';
update public.tenant_invitations set role = 'admin' where role = 'owner';

-- ─── 2. Contraintes : owner devient inécrivable ─────────────────────────────
-- Les CHECK d origine sont anonymes : on les retrouve par leur définition.

do $$
declare _constraint record;
begin
  for _constraint in
    select conrelid::regclass as table_name, conname
      from pg_constraint
     where contype = 'c'
       and conrelid in ('public.tenant_members'::regclass, 'public.tenant_invitations'::regclass)
       and pg_get_constraintdef(oid) ilike '%owner%'
  loop
    execute format('alter table %s drop constraint %I', _constraint.table_name, _constraint.conname);
  end loop;
end $$;

alter table public.tenant_members
  drop constraint if exists tenant_members_role_admin_check;
alter table public.tenant_members
  add constraint tenant_members_role_admin_check
  check (role in ('admin', 'member', 'partner'));

alter table public.tenant_invitations
  drop constraint if exists tenant_invitations_role_admin_check;
alter table public.tenant_invitations
  add constraint tenant_invitations_role_admin_check
  check (role in ('admin', 'member', 'partner'));

-- ─── 3. Fonctions de création : plus aucun site n écrit owner ───────────────

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
  values (_root_id, p_user_id, 'admin')
  on conflict (tenant_id, user_id) do update set role = 'admin';
end;
$$;

-- Le nom historique est conservé : le front l appelle par rpc(). Le créateur
-- d un tenant en devient l admin — il n existe plus de rang au-dessus.
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

  if p_parent_tenant_id is not null then
    if public.user_role_in_tenant(p_parent_tenant_id) <> 'admin'
       and not public.is_super_admin() then
      raise exception 'Droits insuffisants sur le tenant parent.';
    end if;
  end if;

  insert into public.tenants (slug, name, parent_tenant_id)
  values (p_slug, p_name, p_parent_tenant_id)
  returning id into _tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (_tenant_id, _caller, 'admin');

  insert into public.user_preferences (user_id, last_tenant_id)
  values (_caller, _tenant_id)
  on conflict (user_id) do update set last_tenant_id = excluded.last_tenant_id;

  return _tenant_id;
end;
$$;

-- ─── 4. Suppression de tenant : droit de l admin ────────────────────────────
-- La politique d origine la réservait au owner : après conversion, plus
-- personne (hors super admin) n aurait pu supprimer un tenant.

drop policy if exists "tenants_delete" on public.tenants;
create policy "tenants_delete" on public.tenants for delete using (
  is_super_admin()
  or public.user_role_in_tenant(id) = 'admin'
);

-- ─── 5. L admin porte toutes les capabilities ───────────────────────────────

create or replace function public.user_has_capability(
  p_tenant_id uuid,
  p_capability text
)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then true
    when exists (
      select 1
      from public.tenant_members m
      where m.tenant_id = p_tenant_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    ) then true
    else exists (
      select 1
      from public.tenant_role_assignments ra
      join public.tenant_role_definitions rd on rd.id = ra.role_definition_id
      where ra.user_id = auth.uid()
        and ra.revoked_at is null
        and rd.tenant_id = p_tenant_id
        and rd.archived_at is null
        and coalesce((rd.capabilities->>p_capability)::boolean, false) = true
    )
  end;
$$;

grant execute on function public.user_has_capability(uuid, text) to authenticated;

notify pgrst, 'reload schema';

