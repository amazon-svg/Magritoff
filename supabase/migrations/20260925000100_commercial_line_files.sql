-- Fichiers commerciaux typés, associés aux lignes projet, devis et commande.
-- Les octets sont stockés une seule fois ; seules les associations suivent
-- la transformation project_item -> quote_line -> order_line.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commercial_line_files',
  'commercial_line_files',
  false,
  15000000,
  array['application/pdf', 'application/zip', 'application/x-zip-compressed',
        'application/postscript', 'image/jpeg', 'image/png', 'image/tiff']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.commercial_files (
  id            uuid primary key,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  kind          text not null check (kind in (
                  'supplier_quote', 'cutting_template', 'folding_template',
                  'technical_template', 'artwork', 'proof', 'other'
                )),
  filename      text not null check (btrim(filename) <> '' and char_length(filename) <= 255),
  content_type  text not null check (btrim(content_type) <> '' and char_length(content_type) <= 255),
  byte_size     bigint not null check (byte_size between 1 and 15000000),
  storage_path  text not null unique,
  created_at    timestamptz not null default now(),
  constraint commercial_files_storage_path_check
    check (storage_path = tenant_id::text || '/' || id::text)
);

create table if not exists public.project_item_files (
  project_item_id uuid not null references public.project_items(id) on delete cascade,
  file_id         uuid not null references public.commercial_files(id) on delete restrict,
  created_at      timestamptz not null default now(),
  primary key (project_item_id, file_id)
);

create table if not exists public.commercial_quote_line_files (
  quote_line_id uuid not null references public.commercial_quote_lines(id) on delete cascade,
  file_id       uuid not null references public.commercial_files(id) on delete restrict,
  created_at    timestamptz not null default now(),
  primary key (quote_line_id, file_id)
);

create table if not exists public.commercial_order_line_files (
  order_line_id uuid not null references public.commercial_order_lines(id) on delete cascade,
  file_id       uuid not null references public.commercial_files(id) on delete restrict,
  created_at    timestamptz not null default now(),
  primary key (order_line_id, file_id)
);

create index if not exists commercial_files_tenant_idx on public.commercial_files (tenant_id, created_at desc);
create index if not exists project_item_files_file_idx on public.project_item_files (file_id);
create index if not exists commercial_quote_line_files_file_idx on public.commercial_quote_line_files (file_id);
create index if not exists commercial_order_line_files_file_idx on public.commercial_order_line_files (file_id);

alter table public.commercial_files enable row level security;
alter table public.project_item_files enable row level security;
alter table public.commercial_quote_line_files enable row level security;
alter table public.commercial_order_line_files enable row level security;

create policy commercial_files_select on public.commercial_files for select using (
  public.is_super_admin() or tenant_id in (select public.current_user_tenant_ids())
);

create policy project_item_files_select on public.project_item_files for select using (
  public.is_super_admin() or exists (
    select 1 from public.project_items pi
    join public.projects p on p.id = pi.project_id
    where pi.id = project_item_files.project_item_id
      and p.tenant_id in (select public.current_user_tenant_ids())
  )
);

create policy commercial_quote_line_files_select on public.commercial_quote_line_files for select using (
  public.is_super_admin() or exists (
    select 1 from public.commercial_quote_lines ql
    join public.commercial_quotes q on q.id = ql.quote_id
    where ql.id = commercial_quote_line_files.quote_line_id
      and q.tenant_id in (select public.current_user_tenant_ids())
  )
);

create policy commercial_order_line_files_select on public.commercial_order_line_files for select using (
  public.is_super_admin() or exists (
    select 1 from public.commercial_order_lines ol
    join public.commercial_orders o on o.id = ol.order_id
    where ol.id = commercial_order_line_files.order_line_id
      and o.tenant_id in (select public.current_user_tenant_ids())
  )
);

create policy commercial_line_files_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'commercial_line_files'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'
  and ((storage.foldername(name))[1])::uuid in (select public.current_user_tenant_ids())
);

create policy commercial_line_files_storage_select on storage.objects for select to authenticated
using (
  bucket_id = 'commercial_line_files'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'
  and ((storage.foldername(name))[1])::uuid in (select public.current_user_tenant_ids())
);

create policy commercial_line_files_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'commercial_line_files'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'
  and ((storage.foldername(name))[1])::uuid in (select public.current_user_tenant_ids())
);

create or replace function public.propagate_project_item_file_to_quote_lines()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.commercial_quote_line_files (quote_line_id, file_id)
  select ql.id, new.file_id
  from public.commercial_quote_lines ql
  where ql.project_item_id = new.project_item_id
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.inherit_project_item_files_on_quote_line()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.project_item_id is not null then
    insert into public.commercial_quote_line_files (quote_line_id, file_id)
    select new.id, pif.file_id from public.project_item_files pif
    where pif.project_item_id = new.project_item_id
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.propagate_quote_line_file_to_order_lines()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.commercial_order_line_files (order_line_id, file_id)
  select ol.id, new.file_id
  from public.commercial_order_lines ol
  where ol.source_quote_line_id = new.quote_line_id
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.inherit_quote_line_files_on_order_line()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.commercial_order_line_files (order_line_id, file_id)
  select new.id, qlf.file_id from public.commercial_quote_line_files qlf
  where qlf.quote_line_id = new.source_quote_line_id
  on conflict do nothing;
  return new;
end;
$$;

create trigger project_item_files_propagate_after_insert
after insert on public.project_item_files
for each row execute function public.propagate_project_item_file_to_quote_lines();

create trigger commercial_quote_lines_inherit_files_after_insert
after insert on public.commercial_quote_lines
for each row execute function public.inherit_project_item_files_on_quote_line();

create trigger commercial_quote_line_files_propagate_after_insert
after insert on public.commercial_quote_line_files
for each row execute function public.propagate_quote_line_file_to_order_lines();

create trigger commercial_order_lines_inherit_files_after_insert
after insert on public.commercial_order_lines
for each row execute function public.inherit_quote_line_files_on_order_line();

create or replace function public.api_attach_project_item_file(
  p_tenant_id uuid,
  p_project_id uuid,
  p_project_item_id uuid,
  p_file_id uuid,
  p_kind text,
  p_filename text,
  p_content_type text,
  p_byte_size bigint,
  p_storage_path text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_super_admin() and not exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = p_tenant_id and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  ) then
    raise exception 'project.file_forbidden';
  end if;

  if not exists (
    select 1 from public.project_items pi
    join public.projects p on p.id = pi.project_id
    where pi.id = p_project_item_id and p.id = p_project_id and p.tenant_id = p_tenant_id
  ) then
    raise exception 'project.item_not_found';
  end if;

  insert into public.commercial_files (
    id, tenant_id, kind, filename, content_type, byte_size, storage_path
  ) values (
    p_file_id, p_tenant_id, p_kind, p_filename, p_content_type, p_byte_size, p_storage_path
  );
  insert into public.project_item_files (project_item_id, file_id)
  values (p_project_item_id, p_file_id);
end;
$$;

revoke all on function public.api_attach_project_item_file(uuid, uuid, uuid, uuid, text, text, text, bigint, text)
  from public, anon;
grant execute on function public.api_attach_project_item_file(uuid, uuid, uuid, uuid, text, text, text, bigint, text)
  to authenticated;

