create function magrit.claim_order_exports_for_purge(requested_limit integer default 500)
returns table(export_id uuid,tenant_id uuid,storage_path text)
language sql security definer set search_path=pg_catalog,public,magrit as $$
  with candidates as materialized(
    select export.id from public.commercial_order_exports export
     where export.status in('ready','expired') and export.expires_at<clock_timestamp()
       and export.storage_path is not null and export.purge_attempts<3
     order by export.expires_at limit greatest(requested_limit,0) for update skip locked),
  claimed as(
    update public.commercial_order_exports export set status='expired',purge_attempts=export.purge_attempts+1
    from candidates where export.id=candidates.id
    returning export.id,export.tenant_id,export.storage_path)
  select claimed.id,claimed.tenant_id,claimed.storage_path from claimed
$$;

create function magrit.confirm_order_export_files_purged(requested_export_ids uuid[])
returns integer language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare confirmed integer;
begin
  update public.commercial_order_exports export set storage_path=null
   where export.id=any(coalesce(requested_export_ids,array[]::uuid[]))
     and export.status='expired' and export.storage_path is not null;
  get diagnostics confirmed=row_count;
  return confirmed;
end $$;

create function magrit.order_export_object_states(requested_storage_paths text[])
returns table(storage_path text,export_id uuid,status text,purge_attempts integer)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select export.storage_path,export.id,export.status,export.purge_attempts
    from public.commercial_order_exports export
   where export.storage_path=any(requested_storage_paths)
$$;

revoke all on function magrit.claim_order_exports_for_purge(integer),
  magrit.confirm_order_export_files_purged(uuid[]),magrit.order_export_object_states(text[])
  from public,magrit_api,magrit_readonly;
grant execute on function magrit.claim_order_exports_for_purge(integer),
  magrit.confirm_order_export_files_purged(uuid[]),magrit.order_export_object_states(text[])
  to magrit_worker;
