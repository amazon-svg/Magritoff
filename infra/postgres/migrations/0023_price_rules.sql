drop policy product_gammes_read on public.product_gammes;
create policy product_gammes_read on public.product_gammes for select
  using (
    nullif(current_setting('magrit.user_id', true), '') is not null
    or nullif(current_setting('magrit.tenant_id', true), '') is not null
  );

create table public.price_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 200),
  scope text not null check (scope in ('global', 'range', 'customer', 'customer_range')),
  product_range_id uuid references public.product_gammes(id),
  customer_id uuid references public.customers(id),
  value_type text not null check (value_type in ('margin_rate', 'discount_rate')),
  value numeric(6,4) not null check (value >= 0),
  valid_from date not null,
  valid_to date,
  is_active boolean not null default true,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint price_rules_scope_customer_coherence check (
    (scope in ('customer', 'customer_range')) = (customer_id is not null)
  ),
  constraint price_rules_scope_range_coherence check (
    (scope in ('range', 'customer_range')) = (product_range_id is not null)
  ),
  constraint price_rules_period_order check (valid_to is null or valid_to >= valid_from)
);

create index price_rules_selection_idx on public.price_rules (
  tenant_id, scope, customer_id, product_range_id, is_active,
  valid_from desc, created_at desc, id desc
);
create index price_rules_tenant_name_idx on public.price_rules (tenant_id, lower(name));

create table public.price_rules_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  price_rule_id uuid not null references public.price_rules(id) on delete cascade,
  action text not null check (action in ('created', 'updated', 'activated', 'deactivated')),
  actor_id uuid references public.app_users(id) on delete set null,
  occurred_at timestamptz not null default clock_timestamp(),
  before_state jsonb,
  after_state jsonb not null
);

create index price_rules_audit_rule_idx
  on public.price_rules_audit (tenant_id, price_rule_id, occurred_at desc);

create table public.product_range_default_margins (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_range_id uuid not null references public.product_gammes(id) on delete cascade,
  margin_rate numeric(6,4) not null check (margin_rate >= 0),
  updated_by uuid references public.app_users(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (tenant_id, product_range_id)
);

create function magrit.price_rules_before_update()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;

create trigger price_rules_before_update before update on public.price_rules
  for each row execute function magrit.price_rules_before_update();

create function magrit.price_rules_write_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  audit_action text;
begin
  if tg_op = 'INSERT' then
    audit_action := 'created';
  elsif old.is_active is distinct from new.is_active
    and old.name is not distinct from new.name
    and old.value is not distinct from new.value
    and old.valid_from is not distinct from new.valid_from
    and old.valid_to is not distinct from new.valid_to then
    audit_action := case when new.is_active then 'activated' else 'deactivated' end;
  else
    audit_action := 'updated';
  end if;

  insert into public.price_rules_audit (
    tenant_id, price_rule_id, action, actor_id, before_state, after_state
  ) values (
    new.tenant_id,
    new.id,
    audit_action,
    magrit.current_user_id(),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end
$$;

create trigger price_rules_audit_insert after insert on public.price_rules
  for each row execute function magrit.price_rules_write_audit();
create trigger price_rules_audit_update after update on public.price_rules
  for each row when (old.* is distinct from new.*)
  execute function magrit.price_rules_write_audit();

create function magrit.default_margins_before_update()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;

create trigger default_margins_before_update
  before update on public.product_range_default_margins
  for each row execute function magrit.default_margins_before_update();

alter table public.price_rules enable row level security;
alter table public.price_rules force row level security;
alter table public.price_rules_audit enable row level security;
alter table public.product_range_default_margins enable row level security;
alter table public.product_range_default_margins force row level security;

create policy price_rules_read on public.price_rules for select
  using (tenant_id = magrit.current_tenant_id());
create policy price_rules_write on public.price_rules for all
  using (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_pricing')
  )
  with check (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_pricing')
  );

create policy price_rules_audit_read on public.price_rules_audit for select
  using (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_pricing')
  );

create policy product_range_default_margins_read
  on public.product_range_default_margins for select
  using (tenant_id = magrit.current_tenant_id());
create policy product_range_default_margins_write
  on public.product_range_default_margins for all
  using (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_pricing')
  )
  with check (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_pricing')
  );

revoke all on table public.price_rules, public.price_rules_audit,
  public.product_range_default_margins from public;
grant select, insert, update on table public.price_rules to magrit_api;
grant select on table public.price_rules_audit to magrit_api;
grant select, insert, update on table public.product_range_default_margins to magrit_api;

comment on table public.price_rules is
  'Regles tarifaires portables, isolees par tenant et arbitrees par specificite puis recence.';
comment on table public.price_rules_audit is
  'Journal append-only des mutations de regles tarifaires.';
