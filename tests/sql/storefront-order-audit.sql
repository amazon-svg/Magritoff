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
  v_order_id uuid;
  v_event record;
  v_count integer;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour le scénario UM6.5'; end if;

  insert into public.tenants (slug, name)
  values ('um6-storefront-audit', 'UM6 Storefront Audit') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um6-storefront-audit-shop', 'UM6 Audit Shop') returning id into v_shop;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
  values (v_shop, 'audit-a@example.com', 'Audit A', 'active', now()) returning id into v_account_a;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
  values (v_shop, 'audit-b@example.com', 'Audit B', 'active', now()) returning id into v_account_b;

  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
  values
    (v_account_a, v_shop, extensions.digest(convert_to(v_token_a, 'UTF8'), 'sha256'), now() + interval '1 hour'),
    (v_account_b, v_shop, extensions.digest(convert_to(v_token_b, 'UTF8'), 'sha256'), now() + interval '1 hour');

  select (public.api_create_storefront_order(
    v_token_a, v_shop, 'EUR', '',
    '[{"product_id":null,"product_label":"Commande audit","clariprint_options":{},"quantity":1,"unit_price_ht":25}]'::jsonb,
    'um6-audit-create'
  )->>'order_id')::uuid into v_order_id;

  insert into public.tenant_order_role_events (order_id, event_type, actor_user_id, payload)
  values (v_order_id, 'capability_updated', v_actor, '{"internal":true}'::jsonb);

  perform public.api_transition_order_for_identity(
    v_order_id, 'cancelled', null, 'um6-audit-cancel', v_token_a
  );

  select count(*) into v_count
  from public.api_get_order_audit_for_identity(v_order_id, v_token_a);
  if v_count <> 1 then
    raise exception 'L historique storefront expose des événements internes ou omet le statut';
  end if;

  select * into v_event
  from public.api_get_order_audit_for_identity(v_order_id, v_token_a)
  limit 1;
  if v_event.kind <> 'status'
     or v_event.shop_customer_account_id <> v_account_a
     or v_event.actor_id is not null
     or v_event.actor_email is not null then
    raise exception 'L événement UM6.5 expose une identité interne ou perd le compte boutique';
  end if;

  begin
    perform * from public.api_get_order_audit_for_identity(v_order_id, v_token_b);
    raise exception 'Un autre compte boutique a lu l historique de la commande';
  exception when others then
    if sqlerrm not like 'permission_denied:%' then raise; end if;
  end;
end;
$$;

rollback;
