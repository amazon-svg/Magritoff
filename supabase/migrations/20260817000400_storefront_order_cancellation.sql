-- UM6.4 — annulation d'un brouillon par son compte boutique propriétaire.

alter table public.tenant_order_status_events
  alter column actor_id drop not null,
  add column if not exists shop_customer_account_id uuid
    references public.shop_customer_accounts(id) on delete set null,
  add column if not exists acted_by_magrit_user_id uuid
    references auth.users(id) on delete set null;

do $$ begin
  alter table public.tenant_order_status_events
    add constraint tenant_order_status_events_identity_check
    check (actor_id is not null or shop_customer_account_id is not null);
exception when duplicate_object then null;
end $$;

create table if not exists private.storefront_order_transition_receipts (
  id uuid primary key default gen_random_uuid(),
  shop_customer_account_id uuid not null,
  idempotency_key text not null,
  aggregate_id uuid not null references public.tenant_orders(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (shop_customer_account_id, idempotency_key)
);
alter table private.storefront_order_transition_receipts enable row level security;
revoke all on table private.storefront_order_transition_receipts from public, anon, authenticated;

create or replace function public.api_transition_order_for_identity(
  p_order_id uuid,
  p_new_status_code text,
  p_reason text,
  p_idempotency_key text,
  p_opaque_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_session_account_id uuid;
  v_session_shop_id uuid;
  v_session_actor uuid;
  v_order record;
  v_result jsonb;
  v_storefront_allowed boolean := false;
begin
  if p_opaque_token is not null then
    if length(p_opaque_token) not between 32 and 512
       or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then
      raise exception 'permission_denied: storefront session invalid';
    end if;
    select account_id, shop_id, actor_magrit_user_id
      into v_session_account_id, v_session_shop_id, v_session_actor
      from public.api_resolve_shop_customer_session(p_opaque_token);
  end if;

  select id, shop_id, shop_customer_account_id, created_by, status::text
    into v_order from public.tenant_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'order_not_found: %', p_order_id; end if;

  v_storefront_allowed := v_session_account_id is not null
    and v_session_account_id = v_order.shop_customer_account_id
    and v_session_shop_id = v_order.shop_id;
  if not v_storefront_allowed then
    if v_actor is null then raise exception 'permission_denied: order identity mismatch'; end if;
    return public.api_transition_tenant_order_status(
      p_order_id, p_new_status_code, p_reason, p_idempotency_key
    );
  end if;

  if nullif(trim(p_idempotency_key), '') is null then raise exception 'idempotency_key_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    v_session_account_id::text || ':storefront-order.transition:' || p_idempotency_key, 0
  ));
  select result into v_result from private.storefront_order_transition_receipts
   where shop_customer_account_id = v_session_account_id and idempotency_key = p_idempotency_key;
  if v_result is not null then return v_result || jsonb_build_object('replayed', true); end if;

  if p_new_status_code <> 'cancelled' then
    raise exception 'permission_denied: storefront customers may only cancel orders';
  end if;
  if v_order.status <> 'draft' then
    raise exception 'transition_not_allowed: % -> cancelled', v_order.status;
  end if;

  update public.tenant_orders
     set status = 'cancelled', cancelled_at = now(), updated_at = now()
   where id = p_order_id;
  insert into public.tenant_order_status_events (
    order_id, actor_id, shop_customer_account_id, acted_by_magrit_user_id,
    from_status, to_status, reason, metadata
  ) values (
    p_order_id, v_session_actor, v_session_account_id, v_session_actor,
    'draft', 'cancelled', p_reason,
    jsonb_build_object('source', 'storefront_customer')
  );

  v_result := jsonb_build_object(
    'order_id', p_order_id, 'from_status', 'draft',
    'to_status', 'cancelled', 'replayed', false
  );
  insert into private.storefront_order_transition_receipts (
    shop_customer_account_id, idempotency_key, aggregate_id, result
  ) values (v_session_account_id, p_idempotency_key, p_order_id, v_result);
  return v_result;
end;
$$;

revoke all on function public.api_transition_order_for_identity(uuid, text, text, text, text) from public;
grant execute on function public.api_transition_order_for_identity(uuid, text, text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
