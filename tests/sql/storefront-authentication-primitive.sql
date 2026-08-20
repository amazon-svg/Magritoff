-- Exécuté après les migrations UM1.1 à UM2.4 dans une transaction rollbackée.
do $$
declare
  v_shop_id uuid;
  v_shop_slug text;
  v_account_id uuid;
  v_result record;
  v_count integer;
  v_password constant text := 'mot-de-passe-um2-solide';
  v_password_digest text;
begin
  select id, slug into v_shop_id, v_shop_slug
  from public.shops
  order by created_at
  limit 1;
  if v_shop_id is null then
    raise exception 'Fixture UM2: aucune boutique locale disponible';
  end if;
  update public.shops set active = true where id = v_shop_id;

  insert into public.shop_customer_accounts (
    shop_id, email, full_name, status, activated_at
  ) values (
    v_shop_id, 'um2-sql@example.test', 'Fixture UM2', 'active', now()
  ) returning id into v_account_id;

  v_password_digest := encode(
    extensions.digest(convert_to(v_password, 'UTF8'), 'sha256'),
    'hex'
  );
  insert into private.shop_customer_credentials (
    shop_customer_account_id, password_hash
  ) values (
    v_account_id,
    extensions.crypt(v_password_digest, extensions.gen_salt('bf', 4))
  );

  perform * from public.api_authenticate_shop_customer(
    v_shop_slug, 'um2-sql@example.test', 'mauvais-secret'
  );
  select failed_attempt_count into v_count
  from private.shop_customer_credentials
  where shop_customer_account_id = v_account_id;
  if v_count <> 1 then
    raise exception 'Fixture UM2: compteur d echec attendu=1, obtenu=%', v_count;
  end if;

  select * into v_result
  from public.api_authenticate_shop_customer(
    v_shop_slug, ' UM2-SQL@example.test ', v_password
  );
  if v_result.account_id is distinct from v_account_id
    or length(v_result.opaque_token) < 32 then
    raise exception 'Fixture UM2: session valide non emise';
  end if;

  select count(*) into v_count
  from private.shop_customer_sessions s
  where s.shop_customer_account_id = v_account_id
    and s.token_hash = extensions.digest(
      convert_to(v_result.opaque_token, 'UTF8'),
      'sha256'
    );
  if v_count <> 1 then
    raise exception 'Fixture UM2: hash de session absent';
  end if;

  select failed_attempt_count into v_count
  from private.shop_customer_credentials
  where shop_customer_account_id = v_account_id;
  if v_count <> 0 then
    raise exception 'Fixture UM2: compteur non remis a zero';
  end if;

  select count(*) into v_count
  from public.api_authenticate_shop_customer(
    v_shop_slug, 'absent@example.test', v_password
  );
  if v_count <> 0 then
    raise exception 'Fixture UM2: un compte inconnu ne doit rien retourner';
  end if;
end;
$$;
