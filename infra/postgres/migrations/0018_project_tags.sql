create table public.project_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null check (btrim(label) <> '' and char_length(label) <= 60),
  color text not null check (color in ('slate', 'blue', 'green', 'amber', 'red', 'violet')),
  created_at timestamptz not null default clock_timestamp()
);

create unique index project_tags_tenant_label_uidx
  on public.project_tags (tenant_id, btrim(lower(label)));
create index project_tags_tenant_label_idx on public.project_tags (tenant_id, label);

alter table public.project_tags enable row level security;
alter table public.project_tags force row level security;

create policy project_tags_tenant on public.project_tags for all
  using (tenant_id = magrit.current_tenant_id())
  with check (tenant_id = magrit.current_tenant_id());

revoke all on table public.project_tags from public;
grant select, insert, delete on table public.project_tags to magrit_api;

comment on table public.project_tags is
  'Catalogue portable des etiquettes de projets, isole par tenant.';
