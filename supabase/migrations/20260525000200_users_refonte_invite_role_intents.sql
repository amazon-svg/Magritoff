-- =============================================================================
-- Migration S-USERS-REFONTE Phase A complement (Sprint 5, 2026-05-25)
--
-- Ajoute la propagation des rôles à l'acceptation d'invitation. Permet au
-- modal "Inviter un utilisateur" refait de spécifier directement les rôles
-- à assigner (au lieu de l'ancien sélecteur de role enum + permissions jsonb).
--
-- Périmètre :
--   1. Nouvelle colonne tenant_invitations.pending_role_ids uuid[] :
--      stocke les ids des tenant_role_definitions à appliquer à l'acceptation.
--   2. Helper SQL apply_pending_role_assignments(p_invitation_id) :
--      insère les tenant_role_assignments correspondants pour le user accepté.
--   3. Refonte de la RPC accept_tenant_invitation :
--      - Conserve l'ancien comportement (insert tenant_members avec role/
--        scope/permissions legacy) pour back-compat
--      - + applique les pending_role_ids si présents
--
-- Décision Arnaud 2026-05-25 : REFACTO COMPLET pour cohérence UX (les modals
-- Inviter + Permissions exposent désormais uniquement les rôles, plus le
-- legacy role/permissions).
-- =============================================================================

-- ─── 1. Colonne pending_role_ids ──────────────────────────────────────────
alter table public.tenant_invitations
  add column if not exists pending_role_ids uuid[] not null default '{}';

-- ─── 2. Refonte accept_tenant_invitation pour propager pending_role_ids ──
create or replace function public.accept_tenant_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _inv record;
  _caller uuid := auth.uid();
  _role_id uuid;
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

  -- Insert/update tenant_members (back-compat avec ancien systeme legacy)
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

  -- S-USERS-REFONTE Phase A : propage les rôles à l'acceptation. Pour
  -- chaque pending_role_id, crée un tenant_role_assignment actif pour ce
  -- user (skip si déjà actif via WHERE NOT EXISTS sur l'index partiel).
  if _inv.pending_role_ids is not null and array_length(_inv.pending_role_ids, 1) > 0 then
    foreach _role_id in array _inv.pending_role_ids loop
      -- Vérifie que le rôle existe et appartient au bon tenant (defense)
      if exists (
        select 1 from public.tenant_role_definitions rd
        where rd.id = _role_id
          and rd.tenant_id = _inv.tenant_id
          and rd.archived_at is null
      ) then
        insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
        select _role_id, _caller, _inv.invited_by
        where not exists (
          select 1 from public.tenant_role_assignments ra
          where ra.role_definition_id = _role_id
            and ra.user_id = _caller
            and ra.revoked_at is null
        );
      end if;
    end loop;
  end if;

  update public.tenant_invitations
  set accepted_at = now()
  where id = _inv.id;

  return _inv.tenant_id;
end;
$$;

-- Reload schema cache PostgREST
notify pgrst, 'reload schema';
