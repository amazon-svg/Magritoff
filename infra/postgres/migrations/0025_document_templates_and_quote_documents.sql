create or replace function magrit.actor_has_capability(
  requested_tenant_id uuid,
  requested_capability text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, magrit
as $$
  select coalesce(
    exists (
      select 1 from public.user_preferences p
       where p.user_id = magrit.current_user_id() and p.is_admin
    )
    or exists (
      select 1 from public.tenant_members m
       where m.user_id = magrit.current_user_id()
         and m.tenant_id = requested_tenant_id
         and m.role in ('owner', 'admin')
    ),
    false
  ) and requested_capability in (
    'can_manage_pricing',
    'can_manage_notifications',
    'can_manage_production_steps',
    'can_manage_document_templates'
  )
$$;

create table public.document_pdf_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_type text not null default 'quote' check (document_type in ('quote', 'order')),
  name text not null check (btrim(name) <> '' and char_length(name) <= 120),
  status text not null default 'awaiting_upload' check (status in ('awaiting_upload', 'ready')),
  storage_path text,
  byte_size bigint check (byte_size is null or byte_size >= 1),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  page_count integer check (page_count is null or page_count between 1 and 10),
  pages jsonb not null default '[]'::jsonb check (jsonb_typeof(pages) = 'array'),
  lines_block jsonb check (lines_block is null or jsonb_typeof(lines_block) = 'object'),
  is_default boolean not null default false,
  is_active boolean not null default true,
  requested_default boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  created_by uuid references public.app_users(id) on delete set null,
  constraint document_pdf_templates_default_requires_ready
    check (not is_default or (status = 'ready' and is_active)),
  constraint document_pdf_templates_storage_path_canonical
    check (storage_path is null or storage_path = tenant_id::text || '/' || id::text || '.pdf')
);

create unique index document_pdf_templates_tenant_type_name_uidx
  on public.document_pdf_templates (tenant_id, document_type, lower(btrim(name)));
create unique index document_pdf_templates_default_uidx
  on public.document_pdf_templates (tenant_id, document_type) where is_default;
create index document_pdf_templates_tenant_type_idx
  on public.document_pdf_templates (tenant_id, document_type);

create function magrit.document_pdf_templates_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;
create trigger document_pdf_templates_set_updated_at
  before update on public.document_pdf_templates
  for each row execute function magrit.document_pdf_templates_set_updated_at();

create table public.document_pdf_template_fields (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_pdf_templates(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  field text not null check (field in (
    'quote.number', 'quote.issued_at', 'quote.valid_until', 'quote.customer_reference',
    'order.number', 'order.created_at', 'order.quote_number', 'order.customer_reference',
    'order.expected_delivery_date',
    'customer.company_name', 'customer.contact_name', 'customer.billing_address_block',
    'customer.billing_line1', 'customer.billing_line2', 'customer.billing_postal_code',
    'customer.billing_city', 'customer.billing_country', 'customer.email', 'customer.phone',
    'customer.siret', 'customer.vat_number',
    'totals.lines_subtotal', 'totals.global_discount', 'totals.net_total', 'totals.vat_rate',
    'totals.vat_amount', 'totals.total_incl_tax',
    'page.number', 'page.count', 'page.number_of_count'
  )),
  page_index integer not null check (page_index between 0 and 9),
  x numeric(8,2) not null check (x between 0 and 20000),
  y numeric(8,2) not null check (y between 0 and 20000),
  width numeric(8,2) check (width is null or width between 0 and 20000),
  max_lines integer not null default 1 check (max_lines between 1 and 10),
  align text not null check (align in ('left', 'center', 'right')),
  font text not null check (font in (
    'helvetica', 'helvetica-bold', 'helvetica-oblique',
    'times-roman', 'times-bold', 'times-italic',
    'courier', 'courier-bold'
  )),
  font_size numeric(5,2) not null check (font_size between 4 and 72),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint document_pdf_template_fields_unique_field unique (template_id, field)
);

create index document_pdf_template_fields_tenant_idx
  on public.document_pdf_template_fields (tenant_id);
create index document_pdf_template_fields_template_idx
  on public.document_pdf_template_fields (template_id);

create function magrit.document_pdf_template_fields_before_write()
returns trigger language plpgsql as $$
declare
  template_tenant uuid;
begin
  select tenant_id into template_tenant
    from public.document_pdf_templates where id = new.template_id;
  if template_tenant is null or template_tenant <> new.tenant_id then
    raise exception using errcode = '23514', message = 'document_pdf_template_fields.tenant_mismatch';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end
$$;
create trigger document_pdf_template_fields_before_write
  before insert or update on public.document_pdf_template_fields
  for each row execute function magrit.document_pdf_template_fields_before_write();

create table public.quote_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quote_id uuid not null unique references public.commercial_quotes(id) on delete cascade,
  template_id uuid not null references public.document_pdf_templates(id) on delete restrict,
  storage_path text not null,
  byte_size bigint not null check (byte_size >= 1),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  content_type text not null default 'application/pdf' check (content_type = 'application/pdf'),
  page_count integer not null check (page_count >= 1),
  generated_at timestamptz not null,
  generated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  constraint quote_documents_storage_path_canonical
    check (storage_path = tenant_id::text || '/' || quote_id::text || '.pdf')
);

create index quote_documents_tenant_idx on public.quote_documents (tenant_id);
create index quote_documents_template_idx on public.quote_documents (template_id);

create function magrit.quote_documents_assert_same_tenant()
returns trigger language plpgsql as $$
declare
  quote_tenant uuid;
  template_tenant uuid;
begin
  select tenant_id into quote_tenant from public.commercial_quotes where id = new.quote_id;
  select tenant_id into template_tenant from public.document_pdf_templates where id = new.template_id;
  if quote_tenant is null or quote_tenant <> new.tenant_id
     or template_tenant is null or template_tenant <> new.tenant_id then
    raise exception using errcode = '23514', message = 'quote_documents.tenant_mismatch';
  end if;
  return new;
end
$$;
create trigger quote_documents_assert_same_tenant
  before insert or update on public.quote_documents
  for each row execute function magrit.quote_documents_assert_same_tenant();

alter table public.document_pdf_templates enable row level security;
alter table public.document_pdf_templates force row level security;
alter table public.document_pdf_template_fields enable row level security;
alter table public.document_pdf_template_fields force row level security;
alter table public.quote_documents enable row level security;
alter table public.quote_documents force row level security;

create policy document_pdf_templates_select on public.document_pdf_templates
  for select using (tenant_id = magrit.current_tenant_id());
create policy document_pdf_templates_write on public.document_pdf_templates
  for all using (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_document_templates')
  ) with check (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_document_templates')
  );
create policy document_pdf_template_fields_select on public.document_pdf_template_fields
  for select using (tenant_id = magrit.current_tenant_id());
create policy document_pdf_template_fields_write on public.document_pdf_template_fields
  for all using (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_document_templates')
  ) with check (
    tenant_id = magrit.current_tenant_id()
    and magrit.actor_has_capability(tenant_id, 'can_manage_document_templates')
  );
create policy quote_documents_select on public.quote_documents
  for select using (tenant_id = magrit.current_tenant_id());
create policy quote_documents_insert on public.quote_documents
  for insert with check (
    tenant_id = magrit.current_tenant_id()
    and magrit.current_user_id() is not null
  );

revoke all on table public.document_pdf_templates,
  public.document_pdf_template_fields, public.quote_documents from public, magrit_api;
grant select, insert, update, delete on table public.document_pdf_templates,
  public.document_pdf_template_fields to magrit_api;
grant select, insert on table public.quote_documents to magrit_api;

comment on table public.document_pdf_templates is
  'Gabarits PDF portables de devis et commandes, dont les fonds vivent dans S3.';
comment on table public.document_pdf_template_fields is
  'Carte de placement des champs d un gabarit PDF.';
comment on table public.quote_documents is
  'Documents PDF definitifs de devis, append-only et stockes dans S3.';
