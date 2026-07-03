-- =============================================================================
-- Migration S-USERS-REFONTE Phase A fix (Sprint 5, 2026-05-27)
--
-- BUG SECURITE + FONCTIONNEL : accept_tenant_invitation acceptait
-- l'invitation pour le user CONNECTE (auth.uid()) sans verifier que son
-- email correspond a l'email cible de l'invitation. Consequence :
--   - Arnaud connecte en a.mazon@me.com clique sur un lien d'invitation
--     destine a amazon@ageservices.fr
--   - La RPC cree/met a jour le tenant_member pour a.mazon@me.com (deja
--     owner) au lieu de amazon@ageservices.fr
--   - L'invite cible n'est jamais ajoute, l'invitation est "consommee"
--     par le mauvais compte
--   - Faille : n'importe quel user connecte peut s'attribuer une
--     invitation envoyee a un tiers en interceptant le lien
--
-- FIX : verifier lower(auth.email()) == lower(invitation.email) avant
-- d'accepter. Si mismatch, raise une exception explicite que le front
-- (AcceptInvitation.tsx) affiche avec un bouton de deconnexion.
-- =============================================================================

create or replace function public.accept_tenant_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  _inv record;
  _caller uuid := auth.uid();
  _caller_email text;
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

  -- ─── GUARD email (fix 2026-05-27) ─────────────────────────────────────
  -- L'invitation ne peut etre acceptee QUE par le compte dont l'email
  -- correspond a l'email cible. Empeche un user connecte d'intercepter
  -- une invitation destinee a un tiers.
  select email into _caller_email from auth.users where id = _caller;
  if _caller_email is null or lower(_caller_email) <> lower(_inv.email) then
    raise exception
      'EMAIL_MISMATCH: Cette invitation est destinee a %. Vous etes connecte en tant que %. Deconnectez-vous puis reconnectez-vous avec le compte invite.',
      _inv.email, coalesce(_caller_email, 'compte inconnu');
  end if;

  -- Insert/update tenant_members (back-compat legacy)
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

  -- Propage les pending_role_ids vers tenant_role_assignments
  if _inv.pending_role_ids is not null and array_length(_inv.pending_role_ids, 1) > 0 then
    foreach _role_id in array _inv.pending_role_ids loop
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

notify pgrst, 'reload schema';
