create function magrit.change_commercial_order_step(
  requested_tenant_id uuid,requested_order_id uuid,requested_step_id uuid,
  requested_actor_id uuid,requested_note text,requested_service_actor_label text
) returns public.commercial_order_step_changes
language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare context_actor uuid:=magrit.current_user_id(); previous_step uuid; target_active boolean;
  resolved_label text; result public.commercial_order_step_changes;
begin
  if requested_tenant_id is distinct from magrit.current_tenant_id() then
    raise exception using errcode='42501',message='permission_denied: tenant mismatch';
  end if;
  if context_actor is not null then
    if requested_actor_id is distinct from context_actor or not magrit.current_user_can_access_tenant(requested_tenant_id) then
      raise exception using errcode='42501',message='permission_denied: order step change forbidden';
    end if;
    select coalesce(nullif(btrim(display_name),''),email_normalized) into resolved_label
      from public.app_users where id=context_actor;
  else
    if requested_actor_id is not null or nullif(btrim(requested_service_actor_label),'') is null then
      raise exception using errcode='28000',message='authentication_required: service actor label required';
    end if;
    resolved_label:=requested_service_actor_label;
  end if;
  select current_production_step_id into previous_step from public.commercial_orders
    where id=requested_order_id and tenant_id=requested_tenant_id for update;
  if not found then raise exception using errcode='P0002',message='order.not_found'; end if;
  select is_active into target_active from public.production_steps
    where id=requested_step_id and tenant_id=requested_tenant_id;
  if not found then raise exception using errcode='23503',message='production_step.not_found'; end if;
  if not target_active then raise exception using errcode='23514',message='production_step.inactive'; end if;
  if previous_step is not distinct from requested_step_id then
    raise exception using errcode='23514',message='order.step_unchanged';
  end if;
  update public.commercial_orders set current_production_step_id=requested_step_id where id=requested_order_id;
  insert into public.commercial_order_step_changes(order_id,from_step_id,to_step_id,note,actor_id,actor_label)
    values(requested_order_id,previous_step,requested_step_id,requested_note,requested_actor_id,resolved_label)
    returning * into result;
  return result;
end $$;
revoke all on function magrit.change_commercial_order_step(uuid,uuid,uuid,uuid,text,text)
  from public,magrit_worker,magrit_readonly;
grant execute on function magrit.change_commercial_order_step(uuid,uuid,uuid,uuid,text,text) to magrit_api;

comment on function magrit.change_commercial_order_step(uuid,uuid,uuid,uuid,text,text) is
  'Transition atomique portable : verrou, validation, pointeur courant et journal append-only.';
