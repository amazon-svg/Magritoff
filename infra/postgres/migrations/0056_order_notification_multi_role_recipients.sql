create or replace function magrit.order_transition_notification_recipients(
  requested_order_id uuid,
  requested_actor_user_id uuid,
  requested_from_status text,
  requested_to_status text
)
returns table(
  tenant_name text,tenant_slug text,notify_policy text,
  recipient_user_id uuid,recipient_email text
)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  with order_data as (
    select orders.id,orders.tenant_id,tenant.name tenant_name,tenant.slug tenant_slug
      from public.tenant_orders orders
      join public.tenants tenant on tenant.id=orders.tenant_id
     where orders.id=requested_order_id
  ), transition as (
    select matrix.required_capability
      from public.tenant_order_status_transitions matrix
      join order_data on order_data.tenant_id=matrix.tenant_id
     where matrix.from_status_code=requested_from_status
       and matrix.to_status_code=requested_to_status
       and matrix.archived_at is null
  ), actor_roles as (
    select role.notify_policy,role.ordering_index,
           case when transition.required_capability is not null
             and role.capabilities @> jsonb_build_object(transition.required_capability,true)
             then 0 else 1 end priority
      from public.tenant_order_roles assignment
      join public.tenant_role_definitions role on role.id=assignment.role_definition_id
      left join transition on true
     where assignment.order_id=requested_order_id
       and assignment.user_id=requested_actor_user_id
       and assignment.revoked_at is null and role.archived_at is null
  ), active_role as (
    select notify_policy,ordering_index from actor_roles
     order by priority,ordering_index limit 1
  ), policy as (
    select coalesce((select notify_policy from active_role),'chain_next') value,
           (select ordering_index from active_role) active_ordering
  ), recipient_assignments as (
    select assignment.user_id,recipient.email_normalized,role.ordering_index
      from public.tenant_order_roles assignment
      join public.tenant_role_definitions role on role.id=assignment.role_definition_id
      join public.app_users recipient on recipient.id=assignment.user_id and recipient.status='active'
     where assignment.order_id=requested_order_id and assignment.revoked_at is null
       and role.archived_at is null
       and assignment.user_id is distinct from requested_actor_user_id
  )
  select distinct order_data.tenant_name,order_data.tenant_slug,policy.value,
         recipients.user_id,recipients.email_normalized
    from order_data cross join policy join recipient_assignments recipients on true
   where policy.value<>'none'
     and (policy.value='all_roles' or policy.active_ordering is null
       or recipients.ordering_index>policy.active_ordering)
   order by recipients.email_normalized
$$;

comment on function magrit.order_transition_notification_recipients(uuid,uuid,text,text) is
  'Dedoublonne apres filtrage de la chaine afin qu un utilisateur multi-role reste notifie par son role aval.';
