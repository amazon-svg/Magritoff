create unique index customers_tenant_id_uidx on public.customers (tenant_id, id);
create unique index project_tags_tenant_id_uidx on public.project_tags (tenant_id, id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null,
  name text not null check (btrim(name) <> '' and char_length(name) <= 300),
  status text not null default 'active' check (status in ('active', 'archived')),
  hopstudio_session_id text check (
    hopstudio_session_id is null or (btrim(hopstudio_session_id) <> '' and char_length(hopstudio_session_id) <= 255)
  ),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, customer_id) references public.customers(tenant_id, id),
  unique (tenant_id, id)
);

create index projects_tenant_updated_idx on public.projects (tenant_id, updated_at desc, id desc);
create index projects_tenant_customer_idx on public.projects (tenant_id, customer_id);
create index projects_tenant_status_idx on public.projects (tenant_id, status);
create unique index projects_tenant_hopstudio_session_id_unique
  on public.projects (tenant_id, hopstudio_session_id) where hopstudio_session_id is not null;

create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  label text not null check (btrim(label) <> '' and char_length(label) <= 300),
  description_html text,
  quote_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(quote_payload) = 'object'),
  clariprint_config jsonb check (clariprint_config is null or jsonb_typeof(clariprint_config) = 'object'),
  position integer not null check (position >= 0),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, project_id) references public.projects(tenant_id, id) on delete cascade,
  unique (tenant_id, id),
  unique (project_id, position)
);

create table public.project_tag_links (
  tenant_id uuid not null,
  project_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (project_id, tag_id),
  foreign key (tenant_id, project_id) references public.projects(tenant_id, id) on delete cascade,
  foreign key (tenant_id, tag_id) references public.project_tags(tenant_id, id) on delete restrict
);
create index project_tag_links_tag_idx on public.project_tag_links (tenant_id, tag_id);

create table public.commercial_files (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in (
    'supplier_quote', 'cutting_template', 'folding_template',
    'technical_template', 'artwork', 'proof', 'other'
  )),
  visibility text not null default 'internal' check (visibility in ('internal', 'customer')),
  filename text not null check (btrim(filename) <> '' and char_length(filename) <= 255),
  content_type text not null check (btrim(content_type) <> '' and char_length(content_type) <= 255),
  byte_size bigint not null check (byte_size between 1 and 15000000),
  storage_path text not null unique,
  created_at timestamptz not null default clock_timestamp(),
  constraint commercial_files_storage_path_check
    check (storage_path = tenant_id::text || '/' || id::text),
  unique (tenant_id, id)
);

create table public.project_item_files (
  tenant_id uuid not null,
  project_item_id uuid not null,
  file_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (project_item_id, file_id),
  foreign key (tenant_id, project_item_id) references public.project_items(tenant_id, id) on delete cascade,
  foreign key (tenant_id, file_id) references public.commercial_files(tenant_id, id) on delete restrict
);
create index project_item_files_file_idx on public.project_item_files (tenant_id, file_id);

create function magrit.projects_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function magrit.projects_set_updated_at();

alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.project_items enable row level security;
alter table public.project_items force row level security;
alter table public.project_tag_links enable row level security;
alter table public.project_tag_links force row level security;
alter table public.commercial_files enable row level security;
alter table public.commercial_files force row level security;
alter table public.project_item_files enable row level security;
alter table public.project_item_files force row level security;

create policy projects_tenant on public.projects for all
  using (tenant_id = magrit.current_tenant_id())
  with check (tenant_id = magrit.current_tenant_id());
create policy project_items_tenant on public.project_items for all
  using (tenant_id = magrit.current_tenant_id())
  with check (tenant_id = magrit.current_tenant_id());
create policy project_tag_links_tenant on public.project_tag_links for all
  using (tenant_id = magrit.current_tenant_id())
  with check (tenant_id = magrit.current_tenant_id());
create policy commercial_files_tenant on public.commercial_files for all
  using (tenant_id = magrit.current_tenant_id())
  with check (tenant_id = magrit.current_tenant_id());
create policy project_item_files_tenant on public.project_item_files for all
  using (tenant_id = magrit.current_tenant_id())
  with check (tenant_id = magrit.current_tenant_id());

revoke all on table public.projects, public.project_items, public.project_tag_links,
  public.commercial_files, public.project_item_files from public;
grant select, insert, update, delete on table public.projects, public.project_items,
  public.project_tag_links, public.commercial_files, public.project_item_files to magrit_api;

comment on table public.projects is 'Conteneurs de travail commerciaux portables.';
comment on table public.project_items is 'Elements de chiffrage conserves dans un projet.';
comment on table public.commercial_files is 'Metadonnees portables des objets commerciaux stockes dans S3.';
