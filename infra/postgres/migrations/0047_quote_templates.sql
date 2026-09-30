alter table public.user_preferences add column default_quote_template_id text;

create table public.quote_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete restrict,
  name text not null,
  style text not null default 'custom',
  company_name text,address text,postal_code text,city text,country text,phone text,email text,website text,
  siret text,tva_number text,logo_url text,brand_color text default '#111111',accent_color text default '#f59e0b',
  font_family text,validity_days integer default 30,footer_text text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint quote_templates_name_check check (btrim(name)<>'' and char_length(name)<=200),
  constraint quote_templates_style_check check (style in ('classique','atelier','corporate','custom')),
  constraint quote_templates_validity_check check (validity_days is null or validity_days>=0)
);
create index quote_templates_tenant_created_idx on public.quote_templates(tenant_id,created_at,id);
alter table public.quote_templates enable row level security;
alter table public.quote_templates force row level security;
create policy quote_templates_tenant_access on public.quote_templates for all using (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
) with check (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
);
revoke all on table public.quote_templates from public;
grant select,insert,update,delete on table public.quote_templates to magrit_api;

comment on table public.quote_templates is
  'Gabarits HTML historiques de devis, distincts des gabarits PDF document_templates.';
