create table public.product_gammes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_-]{1,160}$'),
  name text not null check (btrim(name) <> '' and char_length(name) <= 160),
  parent_slug text references public.product_gammes(slug) on delete set null,
  matching_rules jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  image_url text,
  created_at timestamptz not null default clock_timestamp(),
  constraint product_gammes_matching_rules_object check (jsonb_typeof(matching_rules) = 'object')
);

create index product_gammes_parent_idx on public.product_gammes(parent_slug);
create index product_gammes_display_order_idx on public.product_gammes(display_order, slug);

create table public.product_definitions (
  id uuid primary key default gen_random_uuid(),
  gamme_slug text not null references public.product_gammes(slug) on delete cascade,
  variation_filter jsonb not null default '{}'::jsonb,
  locale text not null default 'fr',
  name text,
  keywords text[],
  title_template text,
  short_description_template text,
  description_template text,
  h1_template text,
  seo_title text,
  seo_description text,
  schema_org_type text default 'Product',
  usage_examples jsonb not null default '[]'::jsonb,
  faq jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  quality_score numeric,
  generated_by text check (generated_by in ('llm', 'human', 'hybrid')),
  validated_by text check (validated_by in ('llm', 'human', 'pending')) default 'pending',
  image_url text,
  commercial_pitch text,
  benefits jsonb,
  use_cases jsonb,
  technical_spec jsonb,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint product_definitions_variation_filter_object check (jsonb_typeof(variation_filter) = 'object'),
  constraint product_definitions_usage_examples_array check (jsonb_typeof(usage_examples) = 'array'),
  constraint product_definitions_faq_array check (jsonb_typeof(faq) = 'array'),
  constraint product_definitions_locale check (char_length(locale) between 2 and 12),
  constraint product_definitions_version check (version > 0),
  unique (gamme_slug, variation_filter, locale)
);

create index product_definitions_gamme_locale_idx
  on public.product_definitions(gamme_slug, locale);

create index tenant_gamme_subscriptions_tenant_order_idx
  on public.tenant_gamme_subscriptions(tenant_id, display_order, gamme_slug);

alter table public.product_gammes enable row level security;
alter table public.product_gammes force row level security;
alter table public.product_definitions enable row level security;
alter table public.product_definitions force row level security;
alter table public.tenant_gamme_subscriptions enable row level security;
alter table public.tenant_gamme_subscriptions force row level security;

create policy product_gammes_read on public.product_gammes for select
  using (nullif(current_setting('magrit.user_id', true), '') is not null);
create policy product_gammes_admin_write on public.product_gammes for all
  using (
    exists (
      select 1 from public.user_preferences p
       where p.user_id = magrit.current_user_id() and p.is_admin
    )
  )
  with check (
    exists (
      select 1 from public.user_preferences p
       where p.user_id = magrit.current_user_id() and p.is_admin
    )
  );

create policy product_definitions_read on public.product_definitions for select
  using (nullif(current_setting('magrit.user_id', true), '') is not null);
create policy product_definitions_admin_write on public.product_definitions for all
  using (
    exists (
      select 1 from public.user_preferences p
       where p.user_id = magrit.current_user_id() and p.is_admin
    )
  )
  with check (
    exists (
      select 1 from public.user_preferences p
       where p.user_id = magrit.current_user_id() and p.is_admin
    )
  );

create policy tenant_gamme_subscriptions_read on public.tenant_gamme_subscriptions for select
  using (
    exists (
      select 1 from public.user_preferences p
       where p.user_id = magrit.current_user_id() and p.is_admin
    )
    or (
      tenant_id = magrit.current_tenant_id()
      and magrit.current_user_can_access_tenant(tenant_id)
    )
  );
create policy tenant_gamme_subscriptions_write on public.tenant_gamme_subscriptions for all
  using (
    exists (
      select 1 from public.user_preferences p
       where p.user_id = magrit.current_user_id() and p.is_admin
    )
    or (
      tenant_id = magrit.current_tenant_id()
      and magrit.actor_has_capability(tenant_id, 'can_manage_pricing')
    )
  )
  with check (
    exists (
      select 1 from public.user_preferences p
       where p.user_id = magrit.current_user_id() and p.is_admin
    )
    or (
      tenant_id = magrit.current_tenant_id()
      and magrit.actor_has_capability(tenant_id, 'can_manage_pricing')
    )
  );

revoke all on table public.product_gammes from public;
revoke all on table public.product_definitions from public;
revoke all on table public.tenant_gamme_subscriptions from public;
grant select, insert, update, delete on table public.product_gammes to magrit_api;
grant select, insert, update, delete on table public.product_definitions to magrit_api;
grant select, insert, update, delete on table public.tenant_gamme_subscriptions to magrit_api;

comment on table public.product_gammes is
  'Taxonomie PIM portable et partagee entre les tenants.';
comment on table public.product_definitions is
  'Contenu commercial PIM portable, rattache aux gammes partagees.';
comment on table public.tenant_gamme_subscriptions is
  'Selection des gammes PIM exposees par chaque tenant.';
