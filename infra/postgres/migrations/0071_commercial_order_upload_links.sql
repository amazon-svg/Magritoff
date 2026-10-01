create table public.commercial_order_upload_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commercial_orders(id) on delete cascade,
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  max_files integer not null default 10 check(max_files between 1 and 30),
  deposited_count integer not null default 0 check(deposited_count >= 0),
  label text check(label is null or char_length(btrim(label)) between 1 and 200),
  created_by uuid references public.app_users(id) on delete set null,
  created_by_label text check(
    created_by_label is null or char_length(btrim(created_by_label)) between 1 and 320
  ),
  created_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete set null,
  revoked_by_label text check(
    revoked_by_label is null or char_length(btrim(revoked_by_label)) between 1 and 320
  ),
  first_used_at timestamptz,
  last_used_at timestamptz,
  use_count integer not null default 0 check(use_count >= 0),
  constraint commercial_order_upload_links_expiry_after_creation check(expires_at > created_at)
);

create index commercial_order_upload_links_order_idx
  on public.commercial_order_upload_links(order_id, created_at desc);

alter table public.commercial_order_upload_links enable row level security;
alter table public.commercial_order_upload_links force row level security;

create policy commercial_order_upload_links_select on public.commercial_order_upload_links
  for select to magrit_api
  using(
    exists(
      select 1 from public.commercial_orders orders
       where orders.id = commercial_order_upload_links.order_id
         and orders.tenant_id = magrit.current_tenant_id()
    )
  );

create policy commercial_order_upload_links_insert on public.commercial_order_upload_links
  for insert to magrit_api
  with check(
    created_by = magrit.current_user_id()
    and exists(
      select 1 from public.commercial_orders orders
       where orders.id = commercial_order_upload_links.order_id
         and orders.tenant_id = magrit.current_tenant_id()
    )
  );

create policy commercial_order_upload_links_update on public.commercial_order_upload_links
  for update to magrit_api
  using(
    magrit.current_user_id() is not null
    and exists(
      select 1 from public.commercial_orders orders
       where orders.id = commercial_order_upload_links.order_id
         and orders.tenant_id = magrit.current_tenant_id()
    )
  )
  with check(
    exists(
      select 1 from public.commercial_orders orders
       where orders.id = commercial_order_upload_links.order_id
         and orders.tenant_id = magrit.current_tenant_id()
    )
  );

revoke all on table public.commercial_order_upload_links from public, magrit_api;
grant select, insert, update on table public.commercial_order_upload_links to magrit_api;

create function magrit.resolve_order_upload_link(p_token_hash text)
returns table(link_id uuid, order_id uuid, tenant_id uuid)
language sql
stable
security definer
set search_path = pg_catalog, public, magrit
as $$
  select links.id, links.order_id, orders.tenant_id
    from public.commercial_order_upload_links links
    join public.commercial_orders orders on orders.id = links.order_id
   where links.token_hash = p_token_hash
     and links.revoked_at is null
     and links.expires_at > clock_timestamp()
$$;

create function magrit.touch_order_upload_link_context(p_token_hash text)
returns table(
  printer_name text,
  order_number text,
  label text,
  expires_at timestamptz,
  max_files integer,
  deposited_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  selected_link public.commercial_order_upload_links;
begin
  select links.* into selected_link
    from public.commercial_order_upload_links links
   where links.token_hash = p_token_hash
     and links.revoked_at is null
     and links.expires_at > clock_timestamp()
   for update;
  if not found then return; end if;

  update public.commercial_order_upload_links links
     set use_count = links.use_count + 1,
         first_used_at = coalesce(links.first_used_at, clock_timestamp()),
         last_used_at = clock_timestamp()
   where links.id = selected_link.id;

  return query
  select tenants.name, orders.number, selected_link.label, selected_link.expires_at,
         selected_link.max_files, selected_link.deposited_count
    from public.commercial_orders orders
    join public.tenants tenants on tenants.id = orders.tenant_id
   where orders.id = selected_link.order_id;
end
$$;

create function magrit.confirm_order_upload_link_file(
  p_token_hash text,
  p_file_id uuid,
  p_filename text,
  p_content_type text,
  p_byte_size bigint
)
returns table(
  file_id uuid,
  filename text,
  content_type text,
  byte_size bigint,
  deposited_at timestamptz,
  deposited_count integer,
  max_files integer,
  upload_link_id uuid,
  order_id uuid,
  order_number text,
  customer_id uuid,
  tenant_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, magrit
as $$
declare
  selected_link public.commercial_order_upload_links;
  selected_order public.commercial_orders;
  inserted_file public.commercial_order_files;
  live_file_count integer;
  depositor_label text;
begin
  select links.* into selected_link
    from public.commercial_order_upload_links links
   where links.token_hash = p_token_hash
     and links.revoked_at is null
     and links.expires_at > clock_timestamp()
   for update;
  if not found then return; end if;

  select orders.* into selected_order
    from public.commercial_orders orders where orders.id = selected_link.order_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-order-files:' || selected_link.order_id::text, 0));

  if exists(select 1 from public.commercial_order_files files where files.id = p_file_id) then
    raise exception using errcode = '23505', message = 'order_file.already_confirmed';
  end if;
  if selected_link.deposited_count >= selected_link.max_files then
    raise exception using errcode = '23514', message = 'upload_link.file_limit_reached';
  end if;
  select count(*) into live_file_count
    from public.commercial_order_files files
   where files.order_id = selected_link.order_id and files.deleted_at is null;
  if live_file_count >= 30 then
    raise exception using errcode = '23514', message = 'upload_link.file_limit_reached';
  end if;

  depositor_label := case
    when selected_link.label is null then 'Dépôt client par lien'
    else 'Dépôt client — ' || selected_link.label
  end;

  insert into public.commercial_order_files(
    id, order_id, filename, content_type, byte_size, visibility, storage_path,
    deposited_by, deposited_by_label, deposited_via
  ) values(
    p_file_id, selected_link.order_id, p_filename, p_content_type, p_byte_size,
    'internal', selected_order.tenant_id::text || '/' || selected_link.order_id::text || '/' || p_file_id::text,
    null, depositor_label, 'upload_link'
  ) returning * into inserted_file;

  update public.commercial_order_upload_links links
     set deposited_count = links.deposited_count + 1
   where links.id = selected_link.id;

  return query select inserted_file.id, inserted_file.filename, inserted_file.content_type,
    inserted_file.byte_size, inserted_file.deposited_at, selected_link.deposited_count + 1,
    selected_link.max_files, selected_link.id, selected_link.order_id, selected_order.number,
    selected_order.customer_id, selected_order.tenant_id;
end
$$;

revoke all on function magrit.resolve_order_upload_link(text) from public;
revoke all on function magrit.touch_order_upload_link_context(text) from public;
revoke all on function magrit.confirm_order_upload_link_file(text, uuid, text, text, bigint) from public;
grant execute on function magrit.resolve_order_upload_link(text) to magrit_api;
grant execute on function magrit.touch_order_upload_link_context(text) to magrit_api;
grant execute on function magrit.confirm_order_upload_link_file(text, uuid, text, text, bigint) to magrit_api;

comment on table public.commercial_order_upload_links is
  'Liens publics de dépôt : seul le hash SHA-256 du jeton opaque est persisté.';
