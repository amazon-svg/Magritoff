begin;

do $$
declare
  v_actor uuid;
  v_tenant uuid;
  v_shop uuid;
  v_account uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_order_id uuid;
  v_result jsonb;
  v_event record;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour le scénario UM6.4'; end if;
  insert into public.tenants (slug, name)
  values ('um6-storefront-cancel', 'UM6 Storefront Cancel') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um6-storefront-cancel-shop', 'UM6 Cancel Shop') returning id into v_shop;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
  values (v_shop, 'cancel@example.com', 'Cancel Customer', 'active', now()) returning id into v_account;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
  values (v_account, v_shop, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), now() + interval '1 hour');

  select (public.api_create_storefront_order(
    v_token, v_shop, 'EUR', '',
    '[{"product_id":null,"product_label":"À annuler","clariprint_options":{},"quantity":1,"unit_price_ht":25}]'::jsonb,
    'um6-cancel-create'
  )->>'order_id')::uuid into v_order_id;

  begin
    perform public.api_transition_order_for_identity(
      v_order_id, 'validated', null, 'um6-forbidden-validation', v_token
    );
    raise exception 'Le compte boutique a validé une commande';
  exception when others then
    if sqlerrm not like 'permission_denied:%' then raise; end if;
  end;

  select public.api_transition_order_for_identity(
    v_order_id, 'cancelled', null, 'um6-cancel-order', v_token
  ) into v_result;
  if v_result->>'from_status' <> 'draft' or v_result->>'to_status' <> 'cancelled' then
    raise exception 'Annulation UM6.4 invalide';
  end if;
  select * into v_event from public.tenant_order_status_events
   where order_id = v_order_id order by created_at desc limit 1;
  if v_event.shop_customer_account_id <> v_account or v_event.actor_id is not null then
    raise exception 'Audit boutique UM6.4 invalide';
  end if;

  select public.api_transition_order_for_identity(
    v_order_id, 'cancelled', null, 'um6-cancel-order', v_token
  ) into v_result;
  if coalesce((v_result->>'replayed')::boolean, false) is not true then
    raise exception 'Idempotence annulation UM6.4 absente';
  end if;
end;
$$;

rollback;
