-- UM1 — Aligne le cycle de vie des invitations Magrit sur les activations boutique.
--
-- Principes :
--   * un membre deja actif ne peut pas etre invite une seconde fois ;
--   * un renvoi invalide l ancien lien et repart pour 14 jours ;
--   * l adhesion Magrit est explicite depuis le lien d invitation ;
--   * rejouer un lien deja accepte par le meme compte est idempotent.

create or replace function public.api_create_tenant_invitation(
  p_tenant_id uuid,
  p_email text,
  p_access_scope text,
  p_allowed_shop_ids uuid[] default '{}',
  p_role_definition_ids uuid[] default '{}',
  p_role text default 'member'
)
returns table (
  invitation_id uuid,
  invitation_token text,
  invitation_expires_at timestamptz,
  tenant_name text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  _caller uuid := auth.uid();
  _email text := lower(trim(p_email));
  _token text := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  _expires timestamptz := clock_timestamp() + interval '14 days';
  _invitation_id uuid;
  _tenant_name text;
begin
  if _caller is null then raise exception 'authentication_required'; end if;
  if _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_request: email'; end if;
  if p_access_scope <> 'magrit_full' then raise exception 'invalid_request: magrit_scope_required'; end if;
  if p_role not in ('admin', 'member') then raise exception 'invalid_request: role'; end if;
  if p_role = 'admin' and cardinality(coalesce(p_role_definition_ids, '{}')) > 0 then
    raise exception 'invalid_request: admin_options';
  end if;
  if not public.user_has_capability(p_tenant_id, 'can_invite') then
    raise exception 'permission_denied: can_invite';
  end if;

  if exists (
    select 1
      from public.tenant_members member
      join auth.users account on account.id = member.user_id
     where member.tenant_id = p_tenant_id
       and lower(account.email) = _email
  ) then
    raise exception 'already_member';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_role_definition_ids, '{}')) role_id
    where not exists (
      select 1 from public.tenant_role_definitions definition
      where definition.id = role_id
        and definition.tenant_id = p_tenant_id
        and definition.identity_context = 'magrit'
        and definition.system_key in ('option_shops', 'option_orders')
        and definition.archived_at is null
    )
  ) then raise exception 'role_mismatch_tenant'; end if;

  if exists (
    select 1 from public.tenant_invitations invitation
    where invitation.tenant_id = p_tenant_id and lower(invitation.email) = _email
      and invitation.accepted_at is null and invitation.access_scope = 'magrit_full'
  ) then raise exception 'duplicate_pending'; end if;

  select name into _tenant_name from public.tenants where id = p_tenant_id;
  if _tenant_name is null then raise exception 'permission_denied: tenant'; end if;

  insert into public.tenant_invitations (
    tenant_id, email, role, token, expires_at, invited_by,
    access_scope, allowed_shop_ids, permissions, pending_role_ids
  ) values (
    p_tenant_id, _email, p_role, _token, _expires, _caller,
    'magrit_full', '{}',
    '{"can_quote":true,"can_order":true,"can_invite":false}'::jsonb,
    coalesce(p_role_definition_ids, '{}')
  ) returning id into _invitation_id;

  return query select _invitation_id, _token, _expires, _tenant_name;
end;
$$;

create or replace function public.api_reissue_tenant_invitation(
  p_invitation_id uuid
)
returns table (
  invitation_token text,
  invitation_expires_at timestamptz,
  invitation_email text,
  invitation_role text,
  tenant_name text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  _invitation public.tenant_invitations%rowtype;
  _token text := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');
  _expires timestamptz := clock_timestamp() + interval '14 days';
  _tenant_name text;
begin
  select * into _invitation
    from public.tenant_invitations
   where id = p_invitation_id
   for update;

  if _invitation.id is null
    or _invitation.accepted_at is not null
    or _invitation.access_scope <> 'magrit_full'
    or not public.user_has_capability(_invitation.tenant_id, 'can_invite') then
    raise exception 'permission_denied: invitation';
  end if;

  select name into _tenant_name from public.tenants where id = _invitation.tenant_id;
  if _tenant_name is null then raise exception 'permission_denied: tenant'; end if;

  update public.tenant_invitations
     set token = _token,
         expires_at = _expires
   where id = _invitation.id;

  return query select
    _token,
    _expires,
    _invitation.email,
    _invitation.role,
    _tenant_name;
end;
$$;

create or replace function public.accept_tenant_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _inv record;
  _caller uuid := auth.uid();
  _caller_email text;
  _role_id uuid;
begin
  if _caller is null then raise exception 'Authentification requise.'; end if;

  select * into _inv
    from public.tenant_invitations
   where token = p_token;

  if _inv is null then raise exception 'Invitation invalide.'; end if;

  select email into _caller_email from auth.users where id = _caller;
  if _caller_email is null or lower(_caller_email) <> lower(_inv.email) then
    raise exception
      'EMAIL_MISMATCH: Cette invitation est destinee a %. Vous etes connecte en tant que %. Deconnectez-vous puis reconnectez-vous avec le compte invite.',
      _inv.email, coalesce(_caller_email, 'compte inconnu');
  end if;

  -- Le lien peut etre rejoue sans erreur par son destinataire apres succes.
  if _inv.accepted_at is not null then return _inv.tenant_id; end if;
  if _inv.expires_at <= clock_timestamp() then raise exception 'Invitation expiree.'; end if;

  insert into public.tenant_members (
    tenant_id, user_id, role, invited_by,
    access_scope, allowed_shop_ids, permissions
  ) values (
    _inv.tenant_id, _caller, _inv.role, _inv.invited_by,
    _inv.access_scope, _inv.allowed_shop_ids, _inv.permissions
  );

  if _inv.pending_role_ids is not null and array_length(_inv.pending_role_ids, 1) > 0 then
    foreach _role_id in array _inv.pending_role_ids loop
      if exists (
        select 1 from public.tenant_role_definitions definition
        where definition.id = _role_id
          and definition.tenant_id = _inv.tenant_id
          and definition.identity_context = 'magrit'
          and definition.archived_at is null
      ) then
        insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
        values (_role_id, _caller, _inv.invited_by);
      end if;
    end loop;
  end if;

  update public.tenant_invitations
     set accepted_at = clock_timestamp()
   where id = _inv.id;

  return _inv.tenant_id;
end;
$$;

-- L auto-accept historique ne concerne plus les utilisateurs Magrit.
-- Il reste borne aux anciennes invitations boutique le temps de leur reprise.
create or replace function public.auto_accept_pending_invitations()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _caller_email text;
  _caller_id uuid := auth.uid();
  _accepted_count int := 0;
  _inv record;
begin
  if _caller_id is null then return 0; end if;
  select email into _caller_email from auth.users where id = _caller_id;
  if _caller_email is null then return 0; end if;

  for _inv in
    select token
      from public.tenant_invitations
     where lower(email) = lower(_caller_email)
       and accepted_at is null
       and access_scope = 'shop_only'
       and expires_at > clock_timestamp()
  loop
    begin
      perform public.accept_tenant_invitation(_inv.token);
      _accepted_count := _accepted_count + 1;
    exception when others then
      raise warning 'legacy invitation auto-accept failed: %', sqlerrm;
    end;
  end loop;
  return _accepted_count;
end;
$$;

revoke all on function public.api_create_tenant_invitation(uuid, text, text, uuid[], uuid[], text) from public, anon;
grant execute on function public.api_create_tenant_invitation(uuid, text, text, uuid[], uuid[], text) to authenticated;
revoke all on function public.api_reissue_tenant_invitation(uuid) from public, anon;
grant execute on function public.api_reissue_tenant_invitation(uuid) to authenticated;
revoke all on function public.accept_tenant_invitation(text) from public, anon;
grant execute on function public.accept_tenant_invitation(text) to authenticated;
grant execute on function public.auto_accept_pending_invitations() to authenticated;

notify pgrst, 'reload schema';
