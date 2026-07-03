-- =============================================================================
-- Migration BUG-INVITATION-AUTO-ACCEPT (2026-06-10)
--
-- BUG ARNAUD 2026-06-10 : un user invité par email à une boutique (ex
-- emgaar@me.com sur boutique Manitou de imprimerie-ipa, scope=shop_only)
-- qui crée son compte directement via signup au lieu de cliquer le lien
-- /invitations/<token> reçu par mail reste bloqué sur la home Magrit avec
-- la proposition de créer un tenant — sans aucune option pour rejoindre
-- la boutique cible.
--
-- Cause racine : la RPC accept_tenant_invitation n'est appelée que par la
-- route /invitations/:token (AcceptInvitation.tsx). Si l'user signup sans
-- passer par ce lien, le token n'est jamais déclenché → invitation reste
-- accepted_at=null indéfiniment → aucun tenant_member créé.
--
-- Fix systémique : RPC SECURITY DEFINER qui, depuis un user authentifié,
-- accepte automatiquement TOUTES ses invitations pending matchant son
-- email (lower comparison). Réutilise accept_tenant_invitation existante
-- (EMAIL_MISMATCH guard implicite via la RPC sous-jacente). Côté front :
-- appel dans TenantContext.reload() avant la query memberships.
--
-- Sécurité : un user ne peut auto-accepter que ses propres invitations
-- car la RPC sous-jacente check `lower(auth.email()) = lower(inv.email)`.
-- Si un attaquant connait l'email de la cible, il ne peut pas créer
-- d'invitation sans être admin du tenant — donc la surface d'attaque
-- reste celle de l'invitation existante.
--
-- Note SELECT bypass RLS : tenant_invitations RLS ne permet le SELECT
-- qu'aux admins du tenant (cf. 20260424000100_tenants_core.sql:212).
-- Cette RPC SECURITY DEFINER passe outre pour permettre l'enumération
-- de ses propres invitations par email.
-- =============================================================================

create or replace function public.auto_accept_pending_invitations()
returns int
language plpgsql security definer set search_path = public, auth as $$
declare
  _caller_email text;
  _caller_id uuid := auth.uid();
  _accepted_count int := 0;
  _inv record;
begin
  if _caller_id is null then
    return 0;
  end if;

  -- Récupère l'email du caller (bypass RLS auth.users)
  select email into _caller_email from auth.users where id = _caller_id;
  if _caller_email is null then
    return 0;
  end if;

  -- Boucle sur les invitations pending matchant l'email connecté
  -- (lower comparison, non expirées). Pas de tri particulier — on accepte
  -- toutes les invitations légitimes en attente. La RPC sous-jacente fait
  -- les checks individuels (déjà acceptée, expirée, EMAIL_MISMATCH).
  for _inv in
    select token, tenant_id, email
      from public.tenant_invitations
     where lower(email) = lower(_caller_email)
       and accepted_at is null
       and (expires_at is null or expires_at > now())
  loop
    begin
      perform public.accept_tenant_invitation(_inv.token);
      _accepted_count := _accepted_count + 1;
    exception when others then
      -- Log mais continue avec les invitations suivantes — une invitation
      -- corrompue ne doit pas bloquer l'auto-acceptation des autres.
      raise warning 'auto_accept failed for invitation tenant=% token=%: %',
        _inv.tenant_id, _inv.token, sqlerrm;
    end;
  end loop;

  return _accepted_count;
end;
$$;

grant execute on function public.auto_accept_pending_invitations() to authenticated;

notify pgrst, 'reload schema';
