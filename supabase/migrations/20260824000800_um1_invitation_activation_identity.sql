-- UM1 — Le lien d invitation porte l identite : l email est impose à
-- l activation et n est jamais ressaisi par l invite.

create or replace function public.api_get_tenant_invitation_activation(
  p_token text
)
returns table (
  invitation_email text,
  tenant_name text,
  account_exists boolean,
  invitation_expires_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    invitation.email,
    tenant.name,
    exists (
      select 1 from auth.users account
       where lower(account.email) = lower(invitation.email)
    ),
    invitation.expires_at
  from public.tenant_invitations invitation
  join public.tenants tenant on tenant.id = invitation.tenant_id
  where invitation.token = p_token
    and invitation.access_scope = 'magrit_full'
    and invitation.accepted_at is null
    and invitation.expires_at > clock_timestamp();
$$;

revoke all on function public.api_get_tenant_invitation_activation(text) from public;
grant execute on function public.api_get_tenant_invitation_activation(text) to anon, authenticated;

comment on function public.api_get_tenant_invitation_activation(text) is
  'Résout un lien Magrit non expiré afin de verrouiller l email du formulaire d activation.';

notify pgrst, 'reload schema';
