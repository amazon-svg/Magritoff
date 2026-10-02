create function magrit.guard_order_status_transition()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status
     and current_setting('magrit.order_transition',true) <> 'on' then
    raise exception using errcode='42501',message='order_status_transition_requires_audit';
  end if;
  return new;
end $$;

create trigger tenant_orders_status_audit_guard
before update of status on public.tenant_orders
for each row execute function magrit.guard_order_status_transition();

comment on function magrit.guard_order_status_transition() is
  'Interdit toute mutation de statut hors du chemin transactionnel qui ecrit aussi tenant_order_status_events.';
