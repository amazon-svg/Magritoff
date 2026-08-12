-- AF11.2 — commande API sécurisée de création d invitation.
create or replace function public.api_create_tenant_invitation(
  p_tenant_id uuid,
  p_email text,
  p_access_scope text,
  p_allowed_shop_ids uuid[] default '{}',
  p_role_definition_ids uuid[] default '{}'
)
returns table (
  invitation_id uuid,
  invitation_token text,
  invitation_expires_at timestamptz,
  tenant_name text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _caller uuid := auth.uid();
  _email text := lower(trim(p_email));
  _token text := replace(gen_random_uuid()::text, '-', '') || extract(epoch from clock_timestamp())::bigint::text;
  _expires timestamptz := now() + interval '14 days';
  _invitation_id uuid;
  _tenant_name text;
begin
  if _caller is null then raise exception 'authentication_required'; end if;
  if _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_request: email'; end if;
  if p_access_scope not in ('magrit_full', 'shop_only') then raise exception 'invalid_request: access_scope'; end if;
  if p_access_scope = 'shop_only' and cardinality(coalesce(p_allowed_shop_ids, '{}')) = 0 then raise exception 'invalid_request: shop_required'; end if;
  if not public.user_has_capability(p_tenant_id, 'can_invite') then raise exception 'permission_denied: can_invite'; end if;

  if exists (
    select 1 from unnest(coalesce(p_role_definition_ids, '{}')) role_id
    where not exists (
      select 1 from public.tenant_role_definitions definition
      where definition.id = role_id and definition.tenant_id = p_tenant_id and definition.archived_at is null
    )
  ) then raise exception 'role_mismatch_tenant'; end if;

  if p_access_scope = 'shop_only' and exists (
    select 1 from unnest(coalesce(p_allowed_shop_ids, '{}')) shop_id
    where not exists (select 1 from public.shops shop where shop.id = shop_id and shop.tenant_id = p_tenant_id)
  ) then raise exception 'invalid_request: shop_mismatch_tenant'; end if;

  if exists (
    select 1 from public.tenant_invitations invitation
    where invitation.tenant_id = p_tenant_id and invitation.email = _email
      and invitation.accepted_at is null and invitation.expires_at > now()
  ) then raise exception 'duplicate_pending'; end if;

  select name into _tenant_name from public.tenants where id = p_tenant_id;
  if _tenant_name is null then raise exception 'permission_denied: tenant'; end if;

  insert into public.tenant_invitations (
    tenant_id, email, role, token, expires_at, invited_by,
    access_scope, allowed_shop_ids, permissions, pending_role_ids
  ) values (
    p_tenant_id, _email, 'member', _token, _expires, _caller,
    p_access_scope,
    case when p_access_scope = 'shop_only' then coalesce(p_allowed_shop_ids, '{}') else '{}' end,
    '{"can_quote":true,"can_order":true,"can_invite":false}'::jsonb,
    coalesce(p_role_definition_ids, '{}')
  ) returning id into _invitation_id;

  return query select _invitation_id, _token, _expires, _tenant_name;
end;
$$;

revoke all on function public.api_create_tenant_invitation(uuid, text, text, uuid[], uuid[]) from public, anon;
grant execute on function public.api_create_tenant_invitation(uuid, text, text, uuid[], uuid[]) to authenticated;
notify pgrst, 'reload schema';
