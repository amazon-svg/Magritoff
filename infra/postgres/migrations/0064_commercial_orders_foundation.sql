create table public.commercial_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  customer_contact_id uuid references public.customer_contacts(id) on delete set null,
  quote_id uuid not null unique references public.commercial_quotes(id),
  number text not null check(number~'^CDE-[0-9]{4}-[0-9]{5}$'),
  status text not null default 'validated' check(status='validated'),
  source_quote_status text not null check(source_quote_status in('sent','accepted')),
  current_production_step_id uuid references public.production_steps(id) on delete restrict,
  expected_delivery_date date,
  show_discounts boolean not null default false,
  customer_reference text check(customer_reference is null or btrim(customer_reference)<>''),
  lines_subtotal numeric(12,2) not null check(lines_subtotal>=0),
  global_discount numeric(12,2) not null,
  effective_discount_rate numeric(6,4),
  net_total numeric(12,2) not null check(net_total>=0),
  vat_rate numeric(6,4) not null check(vat_rate>=0),
  vat_regime text,
  vat_amount numeric(12,2) not null check(vat_amount>=0),
  total_incl_tax numeric(12,2) not null check(total_incl_tax>=0),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(tenant_id,number)
);
create index commercial_orders_tenant_created_idx on public.commercial_orders(tenant_id,created_at desc,id desc);
create index commercial_orders_tenant_customer_idx on public.commercial_orders(tenant_id,customer_id);
create index commercial_orders_tenant_step_idx on public.commercial_orders(tenant_id,current_production_step_id,created_at desc);

create function magrit.commercial_orders_guard() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then
    if not exists(select 1 from public.tenants where id=old.tenant_id) then return old; end if;
    raise exception using errcode='42501',message='commercial_order.immutable';
  end if;
  if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
    or new.customer_id is distinct from old.customer_id or new.quote_id is distinct from old.quote_id
    or new.number is distinct from old.number or new.source_quote_status is distinct from old.source_quote_status
    or new.lines_subtotal is distinct from old.lines_subtotal or new.global_discount is distinct from old.global_discount
    or new.effective_discount_rate is distinct from old.effective_discount_rate or new.net_total is distinct from old.net_total
    or new.vat_rate is distinct from old.vat_rate or new.vat_regime is distinct from old.vat_regime
    or new.vat_amount is distinct from old.vat_amount or new.total_incl_tax is distinct from old.total_incl_tax
    or new.show_discounts is distinct from old.show_discounts or new.customer_reference is distinct from old.customer_reference
    or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception using errcode='42501',message='commercial_order.immutable';
  end if;
  new.updated_at:=clock_timestamp(); return new;
end $$;
create trigger commercial_orders_guard before update or delete on public.commercial_orders
for each row execute function magrit.commercial_orders_guard();

create table public.commercial_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commercial_orders(id) on delete cascade,
  source_quote_line_id uuid not null references public.commercial_quote_lines(id),
  origin text not null check(origin in('project_item','free')),
  label text not null check(btrim(label)<>''),
  description_html text check(description_html is null or char_length(description_html)<=20000),
  product_config jsonb not null default '{}'::jsonb check(jsonb_typeof(product_config)='object'),
  quantity integer not null check(quantity>0), position integer not null check(position>=0),
  production_price numeric(12,2) not null check(production_price>=0),
  public_price numeric(12,2) not null check(public_price>=0),
  customer_price numeric(12,2) not null check(customer_price>=0),
  applied_margin_rate numeric(6,4) not null, applied_rule_id uuid,
  sale_price numeric(12,2) not null check(sale_price>=0), sale_margin_rate numeric(6,4),
  discount_rate numeric(6,4), margin_variation numeric(6,4),
  breakdown jsonb not null check(jsonb_typeof(breakdown)='array' and jsonb_array_length(breakdown)>=1),
  created_at timestamptz not null default clock_timestamp(), unique(order_id,position)
);
create index commercial_order_lines_source_idx on public.commercial_order_lines(source_quote_line_id);
create function magrit.commercial_order_lines_immutable() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' and not exists(select 1 from public.commercial_orders where id=old.order_id) then return old; end if;
  raise exception using errcode='42501',message='commercial_order_line.immutable';
end $$;
create trigger commercial_order_lines_immutable before update or delete on public.commercial_order_lines
for each row execute function magrit.commercial_order_lines_immutable();

create table public.commercial_order_number_counters(
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  year integer not null check(year between 2000 and 9999),last_value integer not null default 0 check(last_value>=0),
  primary key(tenant_id,year)
);
create table public.commercial_order_step_changes(
  id uuid primary key default gen_random_uuid(),order_id uuid not null references public.commercial_orders(id) on delete cascade,
  from_step_id uuid references public.production_steps(id) on delete restrict,
  to_step_id uuid not null references public.production_steps(id) on delete restrict,
  note text check(note is null or char_length(btrim(note)) between 1 and 1000),
  actor_id uuid references public.app_users(id) on delete set null,
  actor_label text check(actor_label is null or char_length(btrim(actor_label)) between 1 and 320),
  occurred_at timestamptz not null default clock_timestamp()
);
create index commercial_order_step_changes_order_idx on public.commercial_order_step_changes(order_id,occurred_at desc,id desc);

alter table public.commercial_orders enable row level security; alter table public.commercial_orders force row level security;
alter table public.commercial_order_lines enable row level security; alter table public.commercial_order_lines force row level security;
alter table public.commercial_order_number_counters enable row level security; alter table public.commercial_order_number_counters force row level security;
alter table public.commercial_order_step_changes enable row level security; alter table public.commercial_order_step_changes force row level security;
create policy commercial_orders_select on public.commercial_orders for select to magrit_api using(tenant_id=magrit.current_tenant_id());
create policy commercial_order_lines_select on public.commercial_order_lines for select to magrit_api using(exists(select 1 from public.commercial_orders o where o.id=order_id and o.tenant_id=magrit.current_tenant_id()));
create policy commercial_order_steps_select on public.commercial_order_step_changes for select to magrit_api using(exists(select 1 from public.commercial_orders o where o.id=order_id and o.tenant_id=magrit.current_tenant_id()));
revoke all on table public.commercial_orders,public.commercial_order_lines,public.commercial_order_number_counters,public.commercial_order_step_changes from public;
grant select on table public.commercial_orders,public.commercial_order_lines,public.commercial_order_step_changes to magrit_api;

comment on table public.commercial_orders is 'Commandes atelier portables issues de la conversion atomique des devis ; distinctes des commandes boutique tenant_orders.';
