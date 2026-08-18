begin;
do $$
declare
  v_actor uuid; v_tenant uuid; v_shop uuid; v_other_shop uuid; v_account uuid; v_other_account uuid;
  v_token text; v_session_token text := encode(extensions.gen_random_bytes(32), 'hex'); v_count integer; v_ok boolean;
  v_old_digest text := encode(extensions.digest(convert_to('ancien-secret', 'UTF8'), 'sha256'), 'hex');
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour UM9.2'; end if;
  insert into public.tenants (slug, name) values ('um9-password-recovery', 'UM9 Recovery') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name, active) values (v_actor, v_tenant, 'um9-recovery-shop', 'UM9 Shop', true) returning id into v_shop;
  insert into public.shops (owner_user_id, tenant_id, slug, name, active) values (v_actor, v_tenant, 'um9-recovery-other', 'UM9 Other', true) returning id into v_other_shop;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at) values (v_shop, 'client@example.com', 'Client', 'active', now()) returning id into v_account;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at) values (v_other_shop, 'client@example.com', 'Client autre', 'active', now()) returning id into v_other_account;
  insert into private.shop_customer_credentials (shop_customer_account_id, password_hash) values
    (v_account, extensions.crypt(v_old_digest, extensions.gen_salt('bf', 4))),
    (v_other_account, extensions.crypt(v_old_digest, extensions.gen_salt('bf', 4)));
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at) values (v_account, v_shop, extensions.digest(convert_to(v_session_token, 'UTF8'), 'sha256'), now() + interval '1 hour');

  select opaque_token into v_token from public.api_issue_shop_customer_password_recovery('um9-recovery-shop', ' CLIENT@EXAMPLE.COM ');
  if v_token is null then raise exception 'Jeton UM9.2 absent'; end if;
  select count(*) into v_count from public.api_issue_shop_customer_password_recovery('um9-recovery-shop', 'client@example.com');
  if v_count <> 0 then raise exception 'Rate-limit UM9.2 non appliqué'; end if;
  select count(*) into v_count from public.api_issue_shop_customer_password_recovery('um9-recovery-shop', 'absent@example.com');
  if v_count <> 0 then raise exception 'Un compte absent a reçu un jeton'; end if;

  select public.api_reset_shop_customer_password(v_token, 'nouveau-secret') into v_ok;
  if not v_ok then raise exception 'Réinitialisation UM9.2 refusée'; end if;
  select public.api_reset_shop_customer_password(v_token, 'encore-secret') into v_ok;
  if v_ok then raise exception 'Jeton UM9.2 réutilisable'; end if;
  select count(*) into v_count from public.api_resolve_shop_customer_session(v_session_token);
  if v_count <> 0 then raise exception 'Ancienne session non révoquée'; end if;
  select count(*) into v_count from public.api_authenticate_shop_customer('um9-recovery-shop', 'client@example.com', 'ancien-secret');
  if v_count <> 0 then raise exception 'Ancien mot de passe encore valide'; end if;
  select count(*) into v_count from public.api_authenticate_shop_customer('um9-recovery-shop', 'client@example.com', 'nouveau-secret');
  if v_count <> 1 then raise exception 'Nouveau mot de passe invalide'; end if;
  select count(*) into v_count from public.api_authenticate_shop_customer('um9-recovery-other', 'client@example.com', 'ancien-secret');
  if v_count <> 1 then raise exception 'Le compte homonyme d une autre boutique a été modifié'; end if;
end;
$$;
rollback;
