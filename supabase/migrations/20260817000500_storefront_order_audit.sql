-- UM6.5 — historique client limité aux statuts de sa propre commande.

create or replace function public.api_get_order_audit_for_identity(
  p_order_id uuid,
  p_opaque_token text default null
)
returns table (
  event_id uuid,
  order_id uuid,
  kind text,
  event_type text,
  actor_id uuid,
  actor_email text,
  shop_customer_account_id uuid,
  acted_by_magrit_user_id uuid,
  role_name text,
  payload jsonb,
  occurred_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_session_account_id uuid;
  v_session_shop_id uuid;
  v_order record;
  v_storefront_allowed boolean := false;
begin
  if p_opaque_token is not null then
    if length(p_opaque_token) not between 32 and 512
       or p_opaque_token !~ '^[A-Za-z0-9_-]+$' then
      raise exception 'permission_denied: storefront session invalid';
    end if;
    select account_id, shop_id into v_session_account_id, v_session_shop_id
      from public.api_resolve_shop_customer_session(p_opaque_token);
  end if;

  select o.id, o.shop_id, o.shop_customer_account_id
    into v_order from public.tenant_orders o where o.id = p_order_id;
  if v_order.id is null then raise exception 'order_not_found: %', p_order_id; end if;

  v_storefront_allowed := v_session_account_id is not null
    and v_session_account_id = v_order.shop_customer_account_id
    and v_session_shop_id = v_order.shop_id;

  if v_storefront_allowed then
    return query
    select
      e.id,
      e.order_id,
      'status'::text,
      'status_transition'::text,
      null::uuid,
      null::text,
      e.shop_customer_account_id,
      e.acted_by_magrit_user_id,
      null::text,
      jsonb_build_object(
        'from_status', e.from_status::text,
        'to_status', e.to_status::text,
        'reason', e.reason,
        'metadata', coalesce(e.metadata, '{}'::jsonb)
      ),
      e.created_at
    from public.tenant_order_status_events e
    where e.order_id = p_order_id
    order by e.created_at desc;
    return;
  end if;

  if v_actor is null then raise exception 'permission_denied: order identity mismatch'; end if;
  return query
  select
    audit.event_id,
    audit.order_id,
    audit.kind,
    audit.event_type,
    audit.actor_id,
    audit.actor_email,
    null::uuid,
    null::uuid,
    audit.role_name,
    audit.payload,
    audit.occurred_at
  from public.get_order_audit_trail(p_order_id) audit;
end;
$$;

revoke all on function public.api_get_order_audit_for_identity(uuid, text) from public;
grant execute on function public.api_get_order_audit_for_identity(uuid, text) to anon, authenticated;
notify pgrst, 'reload schema';
