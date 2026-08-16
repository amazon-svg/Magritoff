do $$
declare v_token text; v_count integer; v_revoked boolean;
begin
  select encode(extensions.gen_random_bytes(32), 'hex') into v_token;
  insert into private.shop_customer_sessions (
    shop_customer_account_id, shop_id, token_hash, expires_at
  )
  select a.id, a.shop_id,
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour'
  from public.shop_customer_accounts a where a.status = 'active' limit 1;

  select count(*) into v_count from public.api_resolve_shop_customer_session(v_token);
  if v_count <> 1 then raise exception 'Session UM2.6 non résolue'; end if;
  select public.api_revoke_shop_customer_session(v_token) into v_revoked;
  if not v_revoked then raise exception 'Session UM2.6 non révoquée'; end if;
  select count(*) into v_count from public.api_resolve_shop_customer_session(v_token);
  if v_count <> 0 then raise exception 'Session UM2.6 révoquée encore visible'; end if;
end;
$$;
