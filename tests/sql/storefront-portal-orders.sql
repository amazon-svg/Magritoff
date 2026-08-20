begin;

do $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_shop uuid;
  v_account_a uuid;
  v_account_b uuid;
  v_token_a text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_b text := encode(extensions.gen_random_bytes(32), 'hex');
  v_result jsonb;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour le scénario UM6.2'; end if;

  insert into public.tenants (slug, name)
  values ('um6-storefront-portal', 'UM6 Storefront Portal') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um6-storefront-portal-shop', 'UM6 Portal Shop') returning id into v_shop;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
  values (v_shop, 'portal-a@example.com', 'Portal A', 'active', now()) returning id into v_account_a;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
  values (v_shop, 'portal-b@example.com', 'Portal B', 'active', now()) returning id into v_account_b;

  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
  values
    (v_account_a, v_shop, extensions.digest(convert_to(v_token_a, 'UTF8'), 'sha256'), now() + interval '1 hour'),
    (v_account_b, v_shop, extensions.digest(convert_to(v_token_b, 'UTF8'), 'sha256'), now() + interval '1 hour');

  perform public.api_create_storefront_order(
    v_token_a, v_shop, 'EUR', '',
    '[{"product_id":null,"product_label":"Commande A","clariprint_options":{},"quantity":1,"unit_price_ht":10}]'::jsonb,
    'um6-portal-order-a'
  );
  perform public.api_create_storefront_order(
    v_token_b, v_shop, 'EUR', '',
    '[{"product_id":null,"product_label":"Commande B","clariprint_options":{},"quantity":1,"unit_price_ht":20}]'::jsonb,
    'um6-portal-order-b'
  );

  select public.api_get_storefront_portal_orders(v_token_a, v_shop) into v_result;
  if jsonb_array_length(v_result->'orders') <> 1 then
    raise exception 'Le portail UM6.2 révèle les commandes d un autre compte';
  end if;
  if v_result#>>'{orders,0,tenant_order_items,0,product_label}' <> 'Commande A' then
    raise exception 'Le portail UM6.2 ne retourne pas la commande attendue';
  end if;
  if v_result#>>'{orders,0,customer_name}' <> 'Portal A'
     or v_result#>>'{orders,0,customer_email}' <> 'portal-a@example.com' then
    raise exception 'Le portail UM6.2 ne retourne pas l identité de son compte boutique';
  end if;
end;
$$;

rollback;
