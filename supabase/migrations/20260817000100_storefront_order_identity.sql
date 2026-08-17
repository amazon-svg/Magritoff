-- UM6.1 — rattache les commandes storefront au compte boutique et conserve
-- séparément l'acteur Magrit lorsqu'une délégation est utilisée.

alter table public.tenant_orders
  alter column created_by drop not null,
  add column if not exists shop_customer_account_id uuid,
  add column if not exists acted_by_magrit_user_id uuid references auth.users(id) on delete set null;

do $$ begin
  alter table public.tenant_orders
    add constraint tenant_orders_shop_customer_shop_fkey
    foreign key (shop_customer_account_id, shop_id)
    references public.shop_customer_accounts(id, shop_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.tenant_orders
    add constraint tenant_orders_creator_identity_check
    check (created_by is not null or shop_customer_account_id is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.tenant_orders
    add constraint tenant_orders_delegated_actor_check
    check (acted_by_magrit_user_id is null or shop_customer_account_id is not null);
exception when duplicate_object then null;
end $$;

create index if not exists idx_tenant_orders_shop_customer
  on public.tenant_orders(shop_customer_account_id, created_at desc)
  where shop_customer_account_id is not null;

create table if not exists private.storefront_order_command_receipts (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null,
  idempotency_key text not null,
  aggregate_id uuid not null references public.tenant_orders(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (shop_customer_account_id, idempotency_key)
);

alter table private.storefront_order_command_receipts enable row level security;
revoke all on table private.storefront_order_command_receipts from public, anon, authenticated;

create or replace function public.api_create_storefront_order(
  p_opaque_token text,
  p_shop_id uuid,
  p_currency text,
  p_notes text,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_session record;
  v_tenant_id uuid;
  v_order_id uuid;
  v_total_ht numeric(12,2);
  v_result jsonb;
  v_actor uuid;
begin
  if p_opaque_token is null
     or length(p_opaque_token) not between 32 and 512
     or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'permission_denied: storefront session invalid';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'idempotency_key_required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_order_items: at least one item is required';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency';
  end if;

  select * into v_session
    from public.api_resolve_shop_customer_session(p_opaque_token);
  if v_session.account_id is null or v_session.shop_id <> p_shop_id then
    raise exception 'permission_denied: storefront session shop mismatch';
  end if;

  select tenant_id into v_tenant_id
    from public.shops
   where id = p_shop_id and active = true;
  if v_tenant_id is null then
    raise exception 'shop_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_session.account_id::text || ':storefront-order.create:' || p_idempotency_key, 0
  ));

  select result into v_result
    from private.storefront_order_command_receipts
   where shop_customer_account_id = v_session.account_id
     and idempotency_key = p_idempotency_key;
  if v_result is not null then
    return v_result || jsonb_build_object('replayed', true);
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
     where nullif(trim(item->>'product_label'), '') is null
        or coalesce((item->>'quantity')::numeric, 0) <= 0
        or coalesce((item->>'unit_price_ht')::numeric, -1) < 0
  ) then
    raise exception 'invalid_order_items: invalid label, quantity or price';
  end if;

  select round(sum(
    ((item->>'quantity')::numeric * (item->>'unit_price_ht')::numeric)
  ), 2) into v_total_ht
    from jsonb_array_elements(p_items) item;

  v_actor := case when v_session.session_kind = 'delegated'
    then v_session.actor_magrit_user_id else null end;

  insert into public.tenant_orders (
    tenant_id, shop_id, created_by, shop_customer_account_id,
    acted_by_magrit_user_id, status, total_ht, currency, notes
  ) values (
    v_tenant_id, p_shop_id, v_actor, v_session.account_id,
    v_actor, 'draft', v_total_ht, p_currency, coalesce(p_notes, '')
  ) returning id into v_order_id;

  insert into public.tenant_order_items (
    order_id, product_id, product_label, clariprint_options,
    quantity, unit_price_ht, line_total_ht
  )
  select
    v_order_id,
    case when nullif(item->>'product_id', '') is null then null else (item->>'product_id')::uuid end,
    trim(item->>'product_label'),
    coalesce(item->'clariprint_options', '{}'::jsonb),
    (item->>'quantity')::integer,
    (item->>'unit_price_ht')::numeric,
    round((item->>'quantity')::numeric * (item->>'unit_price_ht')::numeric, 2)
  from jsonb_array_elements(p_items) item;

  v_result := jsonb_build_object(
    'order_id', v_order_id,
    'tenant_id', v_tenant_id,
    'shop_id', p_shop_id,
    'total_ht', v_total_ht,
    'currency', p_currency,
    'replayed', false
  );

  insert into private.storefront_order_command_receipts (
    shop_customer_account_id, idempotency_key, aggregate_id, result
  ) values (
    v_session.account_id, p_idempotency_key, v_order_id, v_result
  );

  return v_result;
exception
  when invalid_text_representation then
    raise exception 'invalid_order_items: malformed product id or numeric value';
end;
$$;

revoke all on function public.api_create_storefront_order(text, uuid, text, text, jsonb, text) from public;
grant execute on function public.api_create_storefront_order(text, uuid, text, text, jsonb, text) to anon, authenticated;
notify pgrst, 'reload schema';
