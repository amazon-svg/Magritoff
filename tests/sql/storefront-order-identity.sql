begin;

do $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_shop uuid;
  v_account uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_delegated_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_delegation uuid;
  v_result jsonb;
  v_order record;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour le scénario UM6.1'; end if;

  insert into public.tenants (slug, name)
  values ('um6-storefront-order', 'UM6 Storefront Order') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um6-storefront-order-shop', 'UM6 Shop') returning id into v_shop;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
  values (v_shop, 'buyer-um6@example.com', 'Buyer UM6', 'active', now()) returning id into v_account;
  insert into private.shop_customer_sessions (
    shop_customer_account_id, shop_id, token_hash, expires_at
  ) values (
    v_account, v_shop,
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour'
  );

  select public.api_create_storefront_order(
    v_token, v_shop, 'EUR', '',
    '[{"product_id":null,"product_label":"Flyers","clariprint_options":{},"quantity":2,"unit_price_ht":75}]'::jsonb,
    'um6-storefront-order-create'
  ) into v_result;

  select * into v_order from public.tenant_orders where id = (v_result->>'order_id')::uuid;
  if v_order.shop_customer_account_id <> v_account then
    raise exception 'Commande UM6.1 non rattachée au compte boutique';
  end if;
  if v_order.created_by is not null or v_order.acted_by_magrit_user_id is not null then
    raise exception 'Une commande directe ne doit pas avoir d acteur Magrit';
  end if;

  select public.api_create_storefront_order(
    v_token, v_shop, 'EUR', '',
    '[{"product_id":null,"product_label":"Flyers","clariprint_options":{},"quantity":2,"unit_price_ht":75}]'::jsonb,
    'um6-storefront-order-create'
  ) into v_result;
  if coalesce((v_result->>'replayed')::boolean, false) is not true then
    raise exception 'Idempotence UM6.1 absente';
  end if;

  insert into private.shop_customer_delegations (
    shop_customer_account_id, shop_id, actor_magrit_user_id, expires_at, reason
  ) values (
    v_account, v_shop, v_actor, now() + interval '30 minutes', 'Test UM6.1'
  ) returning id into v_delegation;
  insert into private.shop_customer_sessions (
    shop_customer_account_id, shop_id, token_hash, session_kind,
    actor_magrit_user_id, delegation_id, expires_at
  ) values (
    v_account, v_shop,
    extensions.digest(convert_to(v_delegated_token, 'UTF8'), 'sha256'),
    'delegated', v_actor, v_delegation, now() + interval '30 minutes'
  );

  select public.api_create_storefront_order(
    v_delegated_token, v_shop, 'EUR', '',
    '[{"product_id":null,"product_label":"Affiches","clariprint_options":{},"quantity":1,"unit_price_ht":40}]'::jsonb,
    'um6-delegated-order-create'
  ) into v_result;
  select * into v_order from public.tenant_orders where id = (v_result->>'order_id')::uuid;
  if v_order.created_by <> v_actor or v_order.acted_by_magrit_user_id <> v_actor then
    raise exception 'Acteur Magrit de la délégation UM6.1 non conservé';
  end if;
end;
$$;

rollback;
