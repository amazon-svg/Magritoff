create function magrit.revoke_storefront_session(requested_token_hash bytea)
returns boolean
language plpgsql security definer
set search_path=pg_catalog,private,magrit
as $$
declare revoked_delegation_id uuid;
begin
  if octet_length(requested_token_hash)<>32 then return false; end if;
  update private.shop_customer_sessions session
     set revoked_at=coalesce(session.revoked_at,clock_timestamp())
   where session.token_hash=requested_token_hash and session.revoked_at is null
   returning session.delegation_id into revoked_delegation_id;
  if not found then return false; end if;
  if revoked_delegation_id is not null then
    update private.shop_customer_delegations delegation
       set revoked_at=coalesce(delegation.revoked_at,clock_timestamp())
     where delegation.id=revoked_delegation_id;
  end if;
  return true;
end $$;
revoke all on function magrit.revoke_storefront_session(bytea) from public;
grant execute on function magrit.revoke_storefront_session(bytea) to magrit_api;
