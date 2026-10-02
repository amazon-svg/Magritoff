create unique index commercial_order_lines_order_id_id_uidx
  on public.commercial_order_lines(order_id, id);

create table public.commercial_order_files (
  id uuid primary key,
  order_id uuid not null references public.commercial_orders(id) on delete cascade,
  order_line_id uuid,
  filename text not null check(
    btrim(filename) <> ''
    and char_length(filename) <= 255
    and filename !~ '[[:cntrl:]]'
  ),
  content_type text not null check(btrim(content_type) <> '' and char_length(content_type) <= 255),
  byte_size bigint not null check(byte_size >= 1),
  visibility text not null default 'internal' check(visibility in ('internal', 'customer')),
  storage_path text not null,
  deposited_by uuid references public.app_users(id) on delete set null,
  deposited_by_label text check(
    deposited_by_label is null
    or char_length(btrim(deposited_by_label)) between 1 and 320
  ),
  deposited_via text not null default 'workspace' check(deposited_via in ('workspace', 'upload_link')),
  deposited_at timestamptz not null default clock_timestamp(),
  purge_at timestamptz not null default (clock_timestamp() + interval '30 days'),
  purge_notice_1_id uuid,
  purge_notice_2_id uuid,
  purged_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  deleted_by uuid references public.app_users(id) on delete set null,
  deleted_by_label text check(
    deleted_by_label is null
    or char_length(btrim(deleted_by_label)) between 1 and 320
  ),
  constraint commercial_order_files_line_fk
    foreign key(order_id, order_line_id)
    references public.commercial_order_lines(order_id, id) on delete cascade,
  constraint commercial_order_files_storage_path_shape
    check(
      storage_path ~ (
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
        || order_id::text || '/' || id::text || '$'
      )
    )
);

create index commercial_order_files_order_idx
  on public.commercial_order_files(order_id, deposited_at desc)
  where deleted_at is null;
create index commercial_order_files_line_idx
  on public.commercial_order_files(order_line_id)
  where order_line_id is not null and deleted_at is null;
create index commercial_order_files_purge_idx
  on public.commercial_order_files(purge_at)
  where deleted_at is null;

create function magrit.commercial_order_files_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.visibility is distinct from old.visibility
     or new.deleted_at is distinct from old.deleted_at
     or new.deleted_by is distinct from old.deleted_by
     or new.deleted_by_label is distinct from old.deleted_by_label then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end
$$;

create trigger commercial_order_files_set_updated_at
  before update on public.commercial_order_files
  for each row execute function magrit.commercial_order_files_set_updated_at();

alter table public.commercial_order_files enable row level security;
alter table public.commercial_order_files force row level security;

create policy commercial_order_files_select on public.commercial_order_files
  for select to magrit_api
  using(
    exists(
      select 1 from public.commercial_orders orders
       where orders.id = commercial_order_files.order_id
         and orders.tenant_id = magrit.current_tenant_id()
    )
  );

create policy commercial_order_files_insert on public.commercial_order_files
  for insert to magrit_api
  with check(
    deposited_by = magrit.current_user_id()
    and exists(
      select 1 from public.commercial_orders orders
       where orders.id = commercial_order_files.order_id
         and orders.tenant_id = magrit.current_tenant_id()
    )
  );

create policy commercial_order_files_update on public.commercial_order_files
  for update to magrit_api
  using(
    magrit.current_user_id() is not null
    and exists(
      select 1 from public.commercial_orders orders
       where orders.id = commercial_order_files.order_id
         and orders.tenant_id = magrit.current_tenant_id()
    )
  )
  with check(
    exists(
      select 1 from public.commercial_orders orders
       where orders.id = commercial_order_files.order_id
         and orders.tenant_id = magrit.current_tenant_id()
    )
  );

revoke all on table public.commercial_order_files from public, magrit_api;
grant select, insert, update on table public.commercial_order_files to magrit_api;

comment on table public.commercial_order_files is
  'Fichiers opaques rattachaches aux commandes commerciales ; octets prives dans S3, suppression tracée.';
