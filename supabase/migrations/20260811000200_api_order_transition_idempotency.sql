-- AF5.1 — transition Orders atomique et idempotente.
-- La receipt est privée : seul le wrapper SECURITY DEFINER y accède.

create table if not exists public.order_command_receipts (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  command_type text not null,
  idempotency_key text not null,
  aggregate_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (actor_user_id, command_type, idempotency_key)
);

alter table public.order_command_receipts enable row level security;
revoke all on table public.order_command_receipts from anon, authenticated;

create or replace function public.api_transition_tenant_order_status(
  p_order_id uuid,
  p_new_status_code text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_from_status text;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'idempotency_key_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':order.transition:' || p_idempotency_key, 0));

  select result into v_result
    from public.order_command_receipts
   where actor_user_id = v_actor
     and command_type = 'order.transition'
     and idempotency_key = p_idempotency_key;
  if v_result is not null then
    return v_result || jsonb_build_object('replayed', true);
  end if;

  select status::text into v_from_status
    from public.tenant_orders
   where id = p_order_id;
  if v_from_status is null then
    raise exception 'order_not_found: %', p_order_id;
  end if;

  perform public.transition_tenant_order_status(p_order_id, p_new_status_code, p_reason);
  v_result := jsonb_build_object(
    'order_id', p_order_id,
    'from_status', v_from_status,
    'to_status', p_new_status_code,
    'replayed', false
  );

  insert into public.order_command_receipts
    (actor_user_id, command_type, idempotency_key, aggregate_id, result)
  values
    (v_actor, 'order.transition', p_idempotency_key, p_order_id, v_result);

  return v_result;
end;
$$;

grant execute on function public.api_transition_tenant_order_status(uuid, text, text, text) to authenticated;
notify pgrst, 'reload schema';
