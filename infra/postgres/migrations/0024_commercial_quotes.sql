create table public.commercial_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  project_id uuid not null references public.projects(id),
  source_quote_id uuid,
  number text not null check (number ~ '^DEV-[0-9]{4}-[0-9]{5}$'),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'converted')),
  valid_until date,
  show_discounts boolean not null default false,
  global_discount_rate numeric(6,4),
  target_net_total numeric(12,2),
  vat_rate numeric(6,4),
  sent_at timestamptz,
  last_sent_at timestamptz,
  sent_by uuid references public.app_users(id) on delete set null,
  decided_at timestamptz,
  decided_by_account_id uuid,
  converted_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint commercial_quotes_number_unique_per_tenant unique (tenant_id, number),
  constraint commercial_quotes_global_discount_exclusive check (
    not (global_discount_rate is not null and target_net_total is not null)
  ),
  constraint commercial_quotes_global_discount_rate_max check (
    global_discount_rate is null or global_discount_rate <= 1.0000
  ),
  constraint commercial_quotes_target_net_total_non_negative check (
    target_net_total is null or target_net_total >= 0
  ),
  constraint commercial_quotes_vat_rate_non_negative check (
    vat_rate is null or vat_rate >= 0
  )
);

create index commercial_quotes_tenant_created_idx
  on public.commercial_quotes (tenant_id, created_at desc, id desc);
create index commercial_quotes_tenant_customer_idx
  on public.commercial_quotes (tenant_id, customer_id);
create index commercial_quotes_tenant_project_idx
  on public.commercial_quotes (tenant_id, project_id);
create index commercial_quotes_tenant_status_idx
  on public.commercial_quotes (tenant_id, status);
create index commercial_quotes_source_quote_idx
  on public.commercial_quotes (source_quote_id) where source_quote_id is not null;

create table public.commercial_quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.commercial_quotes(id) on delete cascade,
  origin text not null check (origin in ('project_item', 'free')),
  project_item_id uuid references public.project_items(id),
  label text not null check (btrim(label) <> '' and char_length(label) <= 300),
  description_html text check (description_html is null or char_length(description_html) <= 20000),
  product_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(product_config) = 'object'),
  quantity integer not null check (quantity >= 1),
  chiffrage_quantity integer check (chiffrage_quantity is null or chiffrage_quantity >= 1),
  position integer not null check (position >= 0),
  production_price numeric(12,2) not null check (production_price >= 0),
  public_price numeric(12,2) not null check (public_price >= 0),
  customer_price numeric(12,2) not null check (customer_price >= 0),
  applied_margin_rate numeric(6,4) not null,
  applied_rule_id uuid references public.price_rules(id) on delete set null,
  sale_price numeric(12,2) not null check (sale_price >= 0),
  sale_margin_rate numeric(6,4),
  discount_rate numeric(6,4),
  margin_variation numeric(6,4),
  breakdown jsonb not null check (
    jsonb_typeof(breakdown) = 'array' and jsonb_array_length(breakdown) >= 1
  ),
  created_at timestamptz not null default clock_timestamp(),
  constraint commercial_quote_lines_origin_project_item_coherence check (
    (origin = 'project_item') = (project_item_id is not null)
  ),
  constraint commercial_quote_lines_quote_position_unique
    unique (quote_id, position) deferrable initially deferred
);

create index commercial_quote_lines_project_item_idx
  on public.commercial_quote_lines(project_item_id) where project_item_id is not null;

create table public.commercial_quote_number_counters (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  year integer not null check (year between 2000 and 9999),
  last_value integer not null default 0 check (last_value >= 0),
  primary key (tenant_id, year)
);

create table public.commercial_quote_line_audit (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.commercial_quotes(id) on delete cascade,
  quote_line_id uuid not null,
  change_set_id uuid not null,
  action text not null check (action in ('added', 'updated', 'removed', 'reordered')),
  field text check (field in ('sale_price', 'discount_rate', 'margin_variation', 'quantity', 'position')),
  previous_value text,
  new_value text,
  line_snapshot jsonb,
  actor_id uuid references public.app_users(id) on delete set null,
  actor_label text,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint commercial_quote_line_audit_shape check (
    (action in ('added', 'removed') and field is null and line_snapshot is not null)
    or (action in ('updated', 'reordered') and field is not null and line_snapshot is null)
  )
);

create index commercial_quote_line_audit_line_idx
  on public.commercial_quote_line_audit(quote_line_id, occurred_at desc, id desc);
create index commercial_quote_line_audit_quote_idx
  on public.commercial_quote_line_audit(quote_id, occurred_at desc, id desc);

create table public.commercial_quote_header_audit (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.commercial_quotes(id) on delete cascade,
  change_set_id uuid not null,
  action text not null check (
    action in ('updated', 'sent', 'resent', 'duplicated', 'status_forced', 'accepted', 'rejected', 'converted')
  ),
  field text check (
    field in ('global_discount_rate', 'target_net_total', 'vat_rate', 'show_discounts', 'valid_until')
  ),
  previous_value text,
  new_value text,
  quote_snapshot jsonb,
  actor_id uuid references public.app_users(id) on delete set null,
  actor_label text,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint commercial_quote_header_audit_shape check (
    (action = 'updated' and field is not null and quote_snapshot is null)
    or (action = 'sent' and field is null and quote_snapshot is not null)
    or (action in ('resent', 'duplicated', 'status_forced', 'accepted', 'rejected', 'converted')
      and field is null and quote_snapshot is null)
  )
);

create index commercial_quote_header_audit_quote_idx
  on public.commercial_quote_header_audit(quote_id, occurred_at desc, id desc);

create function magrit.commercial_quotes_before_update()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;
create trigger commercial_quotes_before_update before update on public.commercial_quotes
  for each row execute function magrit.commercial_quotes_before_update();

create function magrit.commercial_quote_lines_require_draft()
returns trigger language plpgsql as $$
declare
  target_quote_id uuid := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;
  quote_status text;
begin
  select status into quote_status from public.commercial_quotes where id = target_quote_id;
  if quote_status is null and tg_op = 'DELETE' then return old; end if;
  if quote_status is distinct from 'draft' then
    raise exception using errcode = 'P0001', message = 'quote_line.quote_not_draft';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
create trigger commercial_quote_lines_require_draft
  before insert or update or delete on public.commercial_quote_lines
  for each row execute function magrit.commercial_quote_lines_require_draft();

create function magrit.commercial_quote_lines_touch_quote()
returns trigger language plpgsql as $$
begin
  update public.commercial_quotes set updated_at = clock_timestamp()
   where id = case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
create trigger commercial_quote_lines_touch_quote
  after insert or update or delete on public.commercial_quote_lines
  for each row execute function magrit.commercial_quote_lines_touch_quote();

alter table public.commercial_quotes enable row level security;
alter table public.commercial_quotes force row level security;
alter table public.commercial_quote_lines enable row level security;
alter table public.commercial_quote_lines force row level security;
alter table public.commercial_quote_number_counters enable row level security;
alter table public.commercial_quote_number_counters force row level security;
alter table public.commercial_quote_line_audit enable row level security;
alter table public.commercial_quote_line_audit force row level security;
alter table public.commercial_quote_header_audit enable row level security;
alter table public.commercial_quote_header_audit force row level security;

create policy commercial_quotes_tenant on public.commercial_quotes for all
  using (tenant_id = magrit.current_tenant_id())
  with check (tenant_id = magrit.current_tenant_id());
create policy commercial_quote_lines_tenant on public.commercial_quote_lines for all
  using (exists (
    select 1 from public.commercial_quotes quote
     where quote.id = quote_id and quote.tenant_id = magrit.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.commercial_quotes quote
     where quote.id = quote_id and quote.tenant_id = magrit.current_tenant_id()
  ));
create policy commercial_quote_counters_tenant on public.commercial_quote_number_counters for all
  using (tenant_id = magrit.current_tenant_id())
  with check (tenant_id = magrit.current_tenant_id());
create policy commercial_quote_line_audit_tenant on public.commercial_quote_line_audit for all
  using (exists (
    select 1 from public.commercial_quotes quote
     where quote.id = quote_id and quote.tenant_id = magrit.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.commercial_quotes quote
     where quote.id = quote_id and quote.tenant_id = magrit.current_tenant_id()
  ));
create policy commercial_quote_header_audit_tenant on public.commercial_quote_header_audit for all
  using (exists (
    select 1 from public.commercial_quotes quote
     where quote.id = quote_id and quote.tenant_id = magrit.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.commercial_quotes quote
     where quote.id = quote_id and quote.tenant_id = magrit.current_tenant_id()
  ));

revoke all on table public.commercial_quotes, public.commercial_quote_lines,
  public.commercial_quote_number_counters, public.commercial_quote_line_audit,
  public.commercial_quote_header_audit from public, magrit_api;
grant select, insert, update, delete on table public.commercial_quotes,
  public.commercial_quote_lines to magrit_api;
grant select, insert, update on table public.commercial_quote_number_counters to magrit_api;
grant select, insert on table public.commercial_quote_line_audit,
  public.commercial_quote_header_audit to magrit_api;

-- Les privileges par defaut du socle accordent initialement le CRUD aux
-- nouvelles tables. Refermer ici les journaux Pricing deja crees garantit
-- aussi leur promesse append-only et retire les suppressions non exposees.
revoke delete on table public.price_rules, public.product_range_default_margins from magrit_api;
revoke insert, update, delete on table public.price_rules_audit from magrit_api;

comment on table public.commercial_quotes is
  'Entetes de devis commerciaux portables, sans dependance Auth ou PostgREST.';
comment on table public.commercial_quote_number_counters is
  'Compteurs annuels par tenant ; avances dans la transaction de creation du devis.';
comment on table public.commercial_quote_line_audit is
  'Journal append-only des mutations de lignes de devis.';
comment on table public.commercial_quote_header_audit is
  'Journal append-only des mutations et transitions d entetes de devis.';
