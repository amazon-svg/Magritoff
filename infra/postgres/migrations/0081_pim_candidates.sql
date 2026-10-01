alter table public.product_definitions
  add column seo_keywords text[],
  add column order_count integer not null default 0 check (order_count >= 0),
  add column last_ordered_at timestamptz;

create index product_definitions_order_count_idx
  on public.product_definitions(order_count desc, id);

create table public.pim_candidates (
  id uuid primary key default gen_random_uuid(),
  source_tenant_id uuid references public.tenants(id) on delete set null,
  source_user_id uuid references public.app_users(id) on delete set null,
  raw_config jsonb not null check (jsonb_typeof(raw_config) = 'object'),
  suggested_kind text,
  suggested_gamme text,
  status text not null default 'pending'
    check (status in ('pending','merged','rejected','superseded')),
  clariprint_normalized jsonb check (
    clariprint_normalized is null or jsonb_typeof(clariprint_normalized) = 'object'
  ),
  llm_enrichment jsonb check (
    llm_enrichment is null or jsonb_typeof(llm_enrichment) = 'object'
  ),
  merged_into uuid references public.product_definitions(id) on delete set null,
  reviewed_by uuid references public.app_users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index pim_candidates_pending_idx on public.pim_candidates(created_at,id)
  where status = 'pending';
create index pim_candidates_source_tenant_idx on public.pim_candidates(source_tenant_id,created_at desc);

alter table public.pim_candidates enable row level security;
alter table public.pim_candidates force row level security;

create policy pim_candidates_admin on public.pim_candidates for all to magrit_api
  using (
    exists (
      select 1 from public.user_preferences preference
       where preference.user_id = magrit.current_user_id() and preference.is_admin
    )
  )
  with check (
    exists (
      select 1 from public.user_preferences preference
       where preference.user_id = magrit.current_user_id() and preference.is_admin
    )
  );

revoke all on table public.pim_candidates from public, magrit_worker, magrit_readonly;
grant select,insert,update,delete on table public.pim_candidates to magrit_api;

create function magrit.enqueue_storefront_pim_candidate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  source_tenant uuid;
  source_actor uuid;
begin
  select orders.tenant_id, coalesce(orders.created_by, shops.owner_user_id)
    into source_tenant, source_actor
    from public.tenant_orders orders
    join public.shops shops on shops.id = orders.shop_id
   where orders.id = new.order_id;

  if source_tenant is not null then
    insert into public.pim_candidates(
      source_tenant_id,source_user_id,raw_config,suggested_kind,suggested_gamme
    ) values (
      source_tenant,
      source_actor,
      jsonb_build_object('name',new.product_label,'quantity',new.quantity)
        || coalesce(new.clariprint_options,'{}'::jsonb),
      new.clariprint_options->>'kind',
      new.clariprint_options->>'gamme_slug'
    );
  end if;
  return new;
end $$;

create trigger tenant_order_items_enqueue_pim
after insert on public.tenant_order_items
for each row execute function magrit.enqueue_storefront_pim_candidate();

create function magrit.enqueue_commercial_pim_candidate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  source_tenant uuid;
  source_actor uuid;
begin
  select orders.tenant_id, orders.created_by
    into source_tenant, source_actor
    from public.commercial_orders orders
   where orders.id = new.order_id;

  if source_tenant is not null then
    insert into public.pim_candidates(
      source_tenant_id,source_user_id,raw_config,suggested_kind,suggested_gamme
    ) values (
      source_tenant,
      source_actor,
      jsonb_build_object('name',new.label,'quantity',new.quantity)
        || coalesce(new.product_config,'{}'::jsonb),
      new.product_config->>'kind',
      new.product_config->>'gamme_slug'
    );
  end if;
  return new;
end $$;

create trigger commercial_order_lines_enqueue_pim
after insert on public.commercial_order_lines
for each row execute function magrit.enqueue_commercial_pim_candidate();

revoke all on function magrit.enqueue_storefront_pim_candidate(),
  magrit.enqueue_commercial_pim_candidate() from public;

comment on table public.pim_candidates is
  'File portable des configurations commandees a dedupliquer et enrichir dans le PIM global.';
