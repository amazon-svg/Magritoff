-- Lecture minimale du budget via le jeton public vérifié : aucun accès anonyme
-- direct aux tables métier ni changement des politiques RLS.
create function magrit.order_upload_link_budget(p_token_hash text)
returns table(max_files integer, deposited_count integer, file_count integer)
language sql
security definer
set search_path = pg_catalog, public, magrit
as $$
  select links.max_files, links.deposited_count,
         (select count(*)::integer from public.commercial_order_files files
           where files.order_id=links.order_id and files.deleted_at is null)
    from public.commercial_order_upload_links links
   where links.token_hash=p_token_hash
     and links.revoked_at is null and links.expires_at>clock_timestamp();
$$;
revoke all on function magrit.order_upload_link_budget(text) from public;
grant execute on function magrit.order_upload_link_budget(text) to magrit_api;

-- La confirmation publique conserve ses verrous, quotas et validation du jeton.
-- Une commande boutique utilise la même référence que le contexte public.
create or replace function magrit.confirm_order_upload_link_file(
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
  selected_order public.tenant_orders;
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
    from public.tenant_orders orders where orders.id = selected_link.order_id;
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
    selected_link.max_files, selected_link.id, selected_link.order_id, coalesce(selected_order.number,upper(left(selected_order.id::text,8))),
    selected_order.customer_id, selected_order.tenant_id;
end
$$;
