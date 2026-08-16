-- UM2.6 — Résolution et révocation atomiques des sessions storefront.

create or replace function public.api_resolve_shop_customer_session(p_opaque_token text)
returns table (
  account_id uuid, shop_id uuid, email text, full_name text,
  account_status text, session_kind text, actor_magrit_user_id uuid,
  delegation_id uuid, expires_at timestamptz
)
language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare v_hash bytea;
begin
  if p_opaque_token !~ '^[A-Za-z0-9_-]{32,512}$' then return; end if;
  v_hash := extensions.digest(convert_to(p_opaque_token, 'UTF8'), 'sha256');
  update private.shop_customer_sessions s
  set last_seen_at = clock_timestamp()
  from public.shop_customer_accounts a
  where s.token_hash = v_hash
    and s.shop_customer_account_id = a.id
    and s.shop_id = a.shop_id
    and s.revoked_at is null
    and s.expires_at > clock_timestamp()
    and (a.status = 'active' or (s.session_kind = 'delegated' and a.status = 'delegated_only'))
  returning a.id, a.shop_id, a.email, a.full_name, a.status,
    s.session_kind, s.actor_magrit_user_id, s.delegation_id, s.expires_at
  into account_id, shop_id, email, full_name, account_status,
    session_kind, actor_magrit_user_id, delegation_id, expires_at;
  if account_id is not null then return next; end if;
end;
$$;

create or replace function public.api_revoke_shop_customer_session(p_opaque_token text)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare v_revoked boolean := false;
begin
  if p_opaque_token !~ '^[A-Za-z0-9_-]{32,512}$' then return false; end if;
  update private.shop_customer_sessions
  set revoked_at = coalesce(revoked_at, clock_timestamp())
  where token_hash = extensions.digest(convert_to(p_opaque_token, 'UTF8'), 'sha256')
    and revoked_at is null;
  v_revoked := found;
  return v_revoked;
end;
$$;

revoke all on function public.api_resolve_shop_customer_session(text) from public, authenticated;
revoke all on function public.api_revoke_shop_customer_session(text) from public, authenticated;
grant execute on function public.api_resolve_shop_customer_session(text) to anon;
grant execute on function public.api_revoke_shop_customer_session(text) to anon;

comment on function public.api_resolve_shop_customer_session(text) is
  'Résout une session active depuis le hash du cookie et actualise last_seen_at.';
comment on function public.api_revoke_shop_customer_session(text) is
  'Révoque idempotemment la session désignée par le hash du cookie.';

notify pgrst, 'reload schema';
