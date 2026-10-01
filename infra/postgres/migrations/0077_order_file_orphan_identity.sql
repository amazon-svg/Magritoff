drop function magrit.order_file_orphan_states(uuid[]);

create function magrit.order_file_orphan_states(requested_file_ids uuid[])
returns table(file_id uuid,order_id uuid,tenant_id uuid,deleted_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select file.id,file.order_id,orders.tenant_id,file.deleted_at
    from public.commercial_order_files file
    join public.commercial_orders orders on orders.id=file.order_id
   where file.id=any(requested_file_ids)
$$;

revoke all on function magrit.order_file_orphan_states(uuid[])
  from public,magrit_api,magrit_readonly;
grant execute on function magrit.order_file_orphan_states(uuid[])
  to magrit_worker;
