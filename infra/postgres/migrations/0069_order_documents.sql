create table public.order_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null unique references public.commercial_orders(id) on delete cascade,
  template_id uuid not null references public.document_pdf_templates(id) on delete restrict,
  storage_path text not null,
  byte_size bigint not null check(byte_size >= 1),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  content_type text not null default 'application/pdf' check(content_type = 'application/pdf'),
  page_count integer not null check(page_count >= 1),
  generated_at timestamptz not null,
  generated_by uuid references public.app_users(id) on delete set null,
  generated_by_label text check(
    generated_by_label is null
    or char_length(btrim(generated_by_label)) between 1 and 320
  ),
  created_at timestamptz not null default clock_timestamp(),
  constraint order_documents_storage_path_canonical
    check(storage_path = tenant_id::text || '/' || order_id::text || '.pdf')
);

create index order_documents_tenant_idx on public.order_documents(tenant_id);
create index order_documents_template_idx on public.order_documents(template_id);

create function magrit.order_documents_assert_same_tenant()
returns trigger
language plpgsql
as $$
declare
  order_tenant uuid;
  template_tenant uuid;
  template_type text;
begin
  select tenant_id into order_tenant
    from public.commercial_orders
   where id = new.order_id;

  select tenant_id, document_type into template_tenant, template_type
    from public.document_pdf_templates
   where id = new.template_id;

  if order_tenant is null or order_tenant <> new.tenant_id then
    raise exception using errcode = '23514', message = 'order.not_found';
  end if;
  if template_tenant is null or template_tenant <> new.tenant_id or template_type <> 'order' then
    raise exception using errcode = '23514', message = 'order.document_template_missing';
  end if;
  return new;
end
$$;

create trigger order_documents_assert_same_tenant
  before insert or update on public.order_documents
  for each row execute function magrit.order_documents_assert_same_tenant();

alter table public.order_documents enable row level security;
alter table public.order_documents force row level security;

create policy order_documents_select on public.order_documents
  for select to magrit_api
  using(tenant_id = magrit.current_tenant_id());

create policy order_documents_insert on public.order_documents
  for insert to magrit_api
  with check(
    tenant_id = magrit.current_tenant_id()
    and generated_by = magrit.current_user_id()
  );

revoke all on table public.order_documents from public, magrit_api;
grant select, insert on table public.order_documents to magrit_api;

comment on table public.order_documents is
  'Bons de commande PDF produits une seule fois, append-only, dont les octets vivent dans S3.';
