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
  v_item_id uuid;
  v_result jsonb;
begin
  select id into v_actor from auth.users where email is not null order by created_at limit 1;
  if v_actor is null then raise exception 'Utilisateur Auth requis pour le scénario UM6.3'; end if;
  insert into public.tenants (slug, name)
  values ('um6-storefront-drafts', 'UM6 Storefront Drafts') returning id into v_tenant;
  insert into public.shops (owner_user_id, tenant_id, slug, name)
  values (v_actor, v_tenant, 'um6-storefront-drafts-shop', 'UM6 Draft Shop') returning id into v_shop;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
  values (v_shop, 'draft-a@example.com', 'Draft A', 'active', now()) returning id into v_account_a;
  insert into public.shop_customer_accounts (shop_id, email, full_name, status, activated_at)
  values (v_shop, 'draft-b@example.com', 'Draft B', 'active', now()) returning id into v_account_b;
  insert into private.shop_customer_sessions (shop_customer_account_id, shop_id, token_hash, expires_at)
  values
    (v_account_a, v_shop, extensions.digest(convert_to(v_token_a, 'UTF8'), 'sha256'), now() + interval '1 hour'),
    (v_account_b, v_shop, extensions.digest(convert_to(v_token_b, 'UTF8'), 'sha256'), now() + interval '1 hour');

  select (public.api_create_storefront_order(
    v_token_a, v_shop, 'EUR', '',
    '[{"product_id":null,"product_label":"Brouillon A","clariprint_options":{},"quantity":2,"unit_price_ht":25}]'::jsonb,
    'um6-draft-create-a'
  )->>'order_id')::uuid into v_order_id;
  select id into v_item_id from public.tenant_order_items where order_id = v_order_id;

  select public.api_get_order_draft_for_identity(v_order_id, v_token_a) into v_result;
  if v_result->>'status' <> 'draft' or v_result->>'created_at' is null then
    raise exception 'Lecture du brouillon UM6.3 invalide';
  end if;

  select public.api_update_order_draft_for_identity(
    v_order_id,
    jsonb_build_array(jsonb_build_object(
      'id', v_item_id, 'product_label', 'Brouillon A modifié', 'quantity', 3, 'unit_price_ht', 30
    )),
    'um6-draft-update-a', v_token_a
  ) into v_result;
  if (v_result->>'total_ht')::numeric <> 90 then
    raise exception 'Mise à jour du brouillon UM6.3 invalide';
  end if;
  select public.api_update_order_draft_for_identity(
    v_order_id,
    jsonb_build_array(jsonb_build_object(
      'id', v_item_id, 'product_label', 'Brouillon A modifié', 'quantity', 3, 'unit_price_ht', 30
    )),
    'um6-draft-update-a', v_token_a
  ) into v_result;
  if coalesce((v_result->>'replayed')::boolean, false) is not true then
    raise exception 'Idempotence de l édition UM6.3 absente';
  end if;

  begin
    perform public.api_get_order_draft_for_identity(v_order_id, v_token_b);
    raise exception 'Le compte B a lu le brouillon du compte A';
  exception when others then
    if sqlerrm not like 'permission_denied:%' then raise; end if;
  end;
end;
$$;

rollback;
