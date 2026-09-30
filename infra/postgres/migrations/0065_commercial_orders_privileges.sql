revoke all on table public.commercial_orders,public.commercial_order_lines,
  public.commercial_order_number_counters,public.commercial_order_step_changes
  from public,magrit_api,magrit_worker,magrit_readonly;

grant select on table public.commercial_orders,public.commercial_order_lines,
  public.commercial_order_step_changes to magrit_api;
grant select on table public.commercial_orders,public.commercial_order_lines,
  public.commercial_order_step_changes to magrit_readonly;

comment on table public.commercial_order_number_counters is
  'Compteur interne de conversion, inaccessible aux rôles API, worker et lecture seule.';
