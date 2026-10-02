alter table public.commercial_orders
  drop constraint commercial_orders_current_production_step_id_fkey,
  add constraint commercial_orders_current_production_step_id_fkey
    foreign key(current_production_step_id) references public.production_steps(id)
    deferrable initially deferred;

alter table public.commercial_order_step_changes
  drop constraint commercial_order_step_changes_from_step_id_fkey,
  drop constraint commercial_order_step_changes_to_step_id_fkey,
  add constraint commercial_order_step_changes_from_step_id_fkey
    foreign key(from_step_id) references public.production_steps(id)
    deferrable initially deferred,
  add constraint commercial_order_step_changes_to_step_id_fkey
    foreign key(to_step_id) references public.production_steps(id)
    deferrable initially deferred;

comment on constraint commercial_order_step_changes_to_step_id_fkey on public.commercial_order_step_changes is
  'Interdit la suppression isolée d une étape citée, mais laisse aboutir la cascade transactionnelle du tenant.';
