alter table public.tenants
  add constraint tenants_siren_pair_check check (
    (siren is null) = (siren_data is null)
  ),
  add constraint tenants_plan_check check (
    plan in ('standard', 'freemium', 'pro', 'enterprise')
  );

comment on constraint tenants_siren_pair_check on public.tenants is
  'Le justificatif SIREN et son payload de verification sont indissociables.';
comment on constraint tenants_plan_check on public.tenants is
  'Catalogue de plans accepte pendant la migration depuis la valeur legacy standard.';
