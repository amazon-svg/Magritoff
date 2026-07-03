-- =============================================================================
-- Migration S3.5 fix (2026-06-01) — cast email varchar -> text
--
-- Initial migration retournait u.email (varchar 255) sans cast, ce qui
-- causait erreur 42804 "structure of query does not match function result
-- type" car le RETURNS TABLE déclare text. Fix : cast explicite.
-- =============================================================================

create or replace function public.get_order_audit_trail(p_order_id uuid)
returns table (
  event_id      uuid,
  order_id      uuid,
  kind          text,
  event_type    text,
  actor_id      uuid,
  actor_email   text,
  role_name     text,
  payload       jsonb,
  occurred_at   timestamptz
)
language plpgsql stable security definer set search_path = public, auth as $$
declare
  _caller    uuid := auth.uid();
  _tenant_id uuid;
begin
  if _caller is null then
    raise exception 'Authentication required';
  end if;

  select t.tenant_id into _tenant_id from public.tenant_orders t where t.id = p_order_id;
  if _tenant_id is null then
    raise exception 'order_not_found: %', p_order_id;
  end if;

  if not (
    public.is_super_admin()
    or _tenant_id in (select public.current_user_tenant_ids())
  ) then
    raise exception 'permission_denied: caller not member of order tenant';
  end if;

  return query
    select
      e.id          as event_id,
      e.order_id    as order_id,
      'status'::text as kind,
      'status_transition'::text as event_type,
      e.actor_id    as actor_id,
      u.email::text as actor_email,
      null::text    as role_name,
      jsonb_build_object(
        'from_status', e.from_status::text,
        'to_status',   e.to_status::text,
        'reason',      e.reason,
        'metadata',    coalesce(e.metadata, '{}'::jsonb)
      ) as payload,
      e.created_at  as occurred_at
    from public.tenant_order_status_events e
    left join auth.users u on u.id = e.actor_id
    where e.order_id = p_order_id

    union all

    select
      re.id             as event_id,
      re.order_id       as order_id,
      'role'::text      as kind,
      re.event_type     as event_type,
      re.actor_user_id  as actor_id,
      u2.email::text    as actor_email,
      rd.name           as role_name,
      jsonb_build_object(
        'target_user_id', re.user_id,
        'role_definition_id', re.role_definition_id,
        'payload', re.payload
      ) as payload,
      re.occurred_at    as occurred_at
    from public.tenant_order_role_events re
    left join auth.users u2 on u2.id = re.actor_user_id
    left join public.tenant_role_definitions rd on rd.id = re.role_definition_id
    where re.order_id = p_order_id

    order by occurred_at desc;
end;
$$;

grant execute on function public.get_order_audit_trail(uuid) to authenticated;

notify pgrst, 'reload schema';
