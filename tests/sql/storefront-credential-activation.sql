begin;

do $$
declare
  v_account uuid; v_actor uuid; v_tenant uuid; v_shop uuid;
  v_token text; v_issued record; v_count integer;
begin
  -- Fixture propre a la transaction (pas de dependance a un auth.users ou
  -- une boutique preexistante en base locale) : cree son propre acteur, son
  -- propre tenant et sa propre boutique, meme patron que les fichiers E10
  -- (ex. tests/sql/gescom-e10-13-production-steps.sql).
  v_actor := gen_random_uuid();
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
    values (v_actor, 'um2-credential-activation-owner@example.test', 'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.tenants (slug, name)
  values ('um2-credential-activation', 'UM2 Credential Activation') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um2-credential-activation-shop', 'UM2 Credential Activation Shop')
  returning id into v_shop;

  insert into public.shop_customer_accounts (shop_id, email, full_name, status)
  values (v_shop, 'activation-um2@example.test', 'Activation UM2', 'invited')
  returning id into v_account;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.shop_customer_activation_tokens (
    shop_customer_account_id, token_hash, issued_by_magrit_user_id, expires_at
  ) values (
    v_account, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
    v_actor, now() + interval '1 hour'
  );
  select * into v_issued from public.api_activate_shop_customer(v_token, 'mot-de-passe-activation');
  if v_issued.account_id is null or v_issued.opaque_token is null then
    raise exception 'Activation UM2.11 ou session refusée';
  end if;
  select count(*) into v_count from private.shop_customer_credentials
  where shop_customer_account_id = v_account;
  if v_count <> 1 then raise exception 'Credential UM2.8 absent'; end if;
  select count(*) into v_count
  from public.api_activate_shop_customer(v_token, 'mot-de-passe-activation');
  if v_count <> 0 then raise exception 'Jeton UM2.11 réutilisable'; end if;
end;
$$;

rollback;
