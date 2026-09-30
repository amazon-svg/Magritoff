create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('company', 'individual')),
  company_name text,
  siret text,
  vat_number text,
  civility text,
  first_name text,
  last_name text,
  billing_address jsonb,
  shipping_address jsonb,
  is_active boolean not null default true,
  siret_verified boolean not null default false,
  siret_verified_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint customers_company_fields_required check (
    type <> 'company' or (company_name is not null and btrim(company_name) <> '' and siret is not null)
  ),
  constraint customers_individual_fields_required check (
    type <> 'individual' or (
      civility is not null and first_name is not null and btrim(first_name) <> ''
      and last_name is not null and btrim(last_name) <> ''
    )
  ),
  constraint customers_civility_values check (civility is null or civility in ('mr', 'mrs')),
  constraint customers_siret_shape check (siret is null or siret ~ '^[0-9]{14}$'),
  constraint customers_siret_verified_requires_value check (not siret_verified or siret is not null),
  constraint customers_billing_address_shape check (
    billing_address is null or (
      jsonb_typeof(billing_address) = 'object' and billing_address ? 'line1'
      and billing_address ? 'postal_code' and billing_address ? 'city' and billing_address ? 'country'
    )
  ),
  constraint customers_shipping_address_shape check (
    shipping_address is null or (
      jsonb_typeof(shipping_address) = 'object' and shipping_address ? 'line1'
      and shipping_address ? 'postal_code' and shipping_address ? 'city' and shipping_address ? 'country'
    )
  )
);

create unique index customers_tenant_siret_uidx on public.customers (tenant_id, siret) where siret is not null;
create index customers_tenant_active_idx on public.customers (tenant_id, is_active);
create index customers_tenant_search_idx on public.customers (
  tenant_id, lower(coalesce(company_name, '')), lower(coalesce(last_name, ''))
);

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  first_name text not null check (btrim(first_name) <> ''),
  last_name text not null check (btrim(last_name) <> ''),
  role text,
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index customer_contacts_customer_idx on public.customer_contacts (customer_id);
create unique index customer_contacts_primary_uidx on public.customer_contacts (customer_id) where is_primary;

create function magrit.customers_before_update()
returns trigger language plpgsql as $$
begin
  if new.siret is distinct from old.siret then
    new.siret_verified := false;
    new.siret_verified_at := null;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end
$$;
create trigger customers_before_update before update on public.customers
  for each row execute function magrit.customers_before_update();

create function magrit.customer_contacts_before_write()
returns trigger language plpgsql as $$
begin
  if new.is_primary then
    update public.customer_contacts set is_primary = false
     where customer_id = new.customer_id and id <> new.id and is_primary;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end
$$;
create trigger customer_contacts_before_write before insert or update on public.customer_contacts
  for each row execute function magrit.customer_contacts_before_write();

alter table public.customers enable row level security;
alter table public.customers force row level security;
alter table public.customer_contacts enable row level security;
alter table public.customer_contacts force row level security;

create policy customers_tenant on public.customers for all
  using (tenant_id = magrit.current_tenant_id())
  with check (tenant_id = magrit.current_tenant_id());
create policy customer_contacts_tenant on public.customer_contacts for all
  using (exists (
    select 1 from public.customers customer
     where customer.id = customer_id and customer.tenant_id = magrit.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.customers customer
     where customer.id = customer_id and customer.tenant_id = magrit.current_tenant_id()
  ));

revoke all on table public.customers, public.customer_contacts from public;
grant select, insert, update, delete on table public.customers, public.customer_contacts to magrit_api;

comment on table public.customers is 'Referentiel client portable, pivot des projets, devis et commandes.';
comment on table public.customer_contacts is 'Interlocuteurs de gestion rattaches aux clients, sans identite d authentification.';
