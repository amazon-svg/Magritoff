begin;

do $$
declare v_account uuid; v_actor uuid; v_token text; v_issued record; v_count integer;
begin
  select id into v_actor from auth.users limit 1;
  select id into v_account from public.shop_customer_accounts
  where status in ('delegated_only', 'invited') limit 1;
  if v_account is null then
    insert into public.shop_customer_accounts (shop_id, email, full_name, status)
    select id, 'activation-um2@example.test', 'Activation UM2', 'invited'
    from public.shops limit 1 returning id into v_account;
  end if;
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
