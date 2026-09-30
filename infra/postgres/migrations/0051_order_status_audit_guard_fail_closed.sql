create or replace function magrit.guard_order_status_transition()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('magrit.order_transition',true),'off') <> 'on' then
    raise exception using errcode='42501',message='order_status_transition_requires_audit';
  end if;
  return new;
end $$;
