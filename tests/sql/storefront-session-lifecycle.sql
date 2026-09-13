begin;

do $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_shop uuid;
  v_account uuid;
  v_token text;
  v_count integer;
  v_revoked boolean;
begin
  v_actor := gen_random_uuid();
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_actor, 'um2-session-lifecycle-owner@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name)
  values ('um2-session-lifecycle', 'UM2 Session Lifecycle') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um2-session-lifecycle-shop', 'UM2 Session Shop') returning id into v_shop;
  insert into public.shop_customer_accounts (
    shop_id, email, full_name, status, activated_at
  ) values (
    v_shop, 'um2-session@example.com', 'UM2 Session', 'active', now()
  ) returning id into v_account;

  select encode(extensions.gen_random_bytes(32), 'hex') into v_token;
  insert into private.shop_customer_sessions (
    shop_customer_account_id, shop_id, token_hash, expires_at
  ) values (
    v_account, v_shop,
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
    now() + interval '1 hour'
  );

  select count(*) into v_count from public.api_resolve_shop_customer_session(v_token);
  if v_count <> 1 then raise exception 'Session UM2.6 non résolue'; end if;
  select public.api_revoke_shop_customer_session(v_token) into v_revoked;
  if not v_revoked then raise exception 'Session UM2.6 non révoquée'; end if;
  select count(*) into v_count from public.api_resolve_shop_customer_session(v_token);
  if v_count <> 0 then raise exception 'Session UM2.6 révoquée encore visible'; end if;
end;
$$;

rollback;
