create function magrit.claim_order_files_for_purge(requested_limit integer default 500)
returns table(file_id uuid,order_id uuid,tenant_id uuid,byte_size bigint)
language sql security definer set search_path=pg_catalog,public,magrit as $$
  with candidates as materialized (
    select file.id,file.order_id,file.byte_size,orders.tenant_id
      from public.commercial_order_files file
      join public.commercial_orders orders on orders.id=file.order_id
      join public.commercial_settings settings
        on settings.tenant_id=orders.tenant_id and settings.order_file_purge_enabled
     where file.deleted_at is null and file.purged_at is null
       and magrit.order_file_effective_purge_at(file.purge_at,settings.order_file_purge_enabled_at)<=clock_timestamp()
       and exists(select 1 from public.commercial_order_file_purge_notices notice
         where notice.id=file.purge_notice_1_id and notice.tenant_id=orders.tenant_id
           and notice.confirmed_at is not null and notice.failed_at is null
           and notice.confirmed_at>=settings.order_file_purge_enabled_at)
       and exists(select 1 from public.commercial_order_file_purge_notices notice
         where notice.id=file.purge_notice_2_id and notice.tenant_id=orders.tenant_id
           and notice.confirmed_at is not null and notice.failed_at is null
           and notice.confirmed_at>=settings.order_file_purge_enabled_at)
       and file.purge_notice_1_id is distinct from file.purge_notice_2_id
     order by file.id limit greatest(requested_limit,0) for update of file skip locked
  ),marked as (
    update public.commercial_order_files file set
      deleted_at=clock_timestamp(),purged_at=clock_timestamp(),deleted_by=null,deleted_by_label='Purge automatique'
    from candidates where file.id=candidates.id
    returning file.id,candidates.order_id,candidates.tenant_id,candidates.byte_size
  ) select marked.id,marked.order_id,marked.tenant_id,marked.byte_size from marked
$$;

create function magrit.count_blocked_order_file_purges()
returns table(tenant_id uuid,reason text,count integer)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select orders.tenant_id,
    case
      when not coalesce(settings.order_file_purge_enabled,false) then 'purge_desactivee'
      when file.purge_notice_1_id is null or file.purge_notice_2_id is null then 'rappel_non_emis'
      when file.purge_notice_1_id=file.purge_notice_2_id then 'rappels_identiques'
      when first_notice.failed_at is not null or second_notice.failed_at is not null then 'rappel_en_echec'
      else 'rappel_non_confirme'
    end reason,count(*)::integer
  from public.commercial_order_files file
  join public.commercial_orders orders on orders.id=file.order_id
  left join public.commercial_settings settings on settings.tenant_id=orders.tenant_id
  left join public.commercial_order_file_purge_notices first_notice
    on first_notice.id=file.purge_notice_1_id and first_notice.tenant_id=orders.tenant_id
  left join public.commercial_order_file_purge_notices second_notice
    on second_notice.id=file.purge_notice_2_id and second_notice.tenant_id=orders.tenant_id
  where file.deleted_at is null and file.purged_at is null
    and(case when coalesce(settings.order_file_purge_enabled,false)
      then magrit.order_file_effective_purge_at(file.purge_at,settings.order_file_purge_enabled_at)
      else file.purge_at end)<=clock_timestamp()
    and not(
      coalesce(settings.order_file_purge_enabled,false)
      and file.purge_notice_1_id is not null and file.purge_notice_2_id is not null
      and file.purge_notice_1_id is distinct from file.purge_notice_2_id
      and first_notice.confirmed_at is not null and first_notice.failed_at is null
      and first_notice.confirmed_at>=settings.order_file_purge_enabled_at
      and second_notice.confirmed_at is not null and second_notice.failed_at is null
      and second_notice.confirmed_at>=settings.order_file_purge_enabled_at)
  group by orders.tenant_id,reason
$$;

create function magrit.record_order_files_purged(
  requested_tenant_id uuid,requested_file_count integer,requested_order_count integer,
  requested_byte_size_freed bigint,requested_order_ids uuid[]
)
returns void language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
begin
  if requested_file_count<1 or requested_order_count<1 or requested_byte_size_freed<1
    or coalesce(array_length(requested_order_ids,1),0)<1 then
    raise exception using errcode='22023',message='order_files_purged.invalid_summary';
  end if;
  insert into public.outbox_events(
    id,tenant_id,event_name,event_version,aggregate_type,aggregate_id,payload,occurred_at
  ) values(gen_random_uuid(),requested_tenant_id,'order_files.purged',1,'tenant',requested_tenant_id,
    jsonb_build_object('file_count',requested_file_count,'order_count',requested_order_count,
      'byte_size_freed',requested_byte_size_freed,'order_ids',to_jsonb(requested_order_ids)),clock_timestamp());
end $$;

create function magrit.order_file_orphan_states(requested_file_ids uuid[])
returns table(file_id uuid,deleted_at timestamptz)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select file.id,file.deleted_at from public.commercial_order_files file where file.id=any(requested_file_ids)
$$;

revoke all on function magrit.claim_order_files_for_purge(integer),
  magrit.count_blocked_order_file_purges(),
  magrit.record_order_files_purged(uuid,integer,integer,bigint,uuid[]),
  magrit.order_file_orphan_states(uuid[])
  from public,magrit_api,magrit_readonly;
grant execute on function magrit.claim_order_files_for_purge(integer),
  magrit.count_blocked_order_file_purges(),
  magrit.record_order_files_purged(uuid,integer,integer,bigint,uuid[]),
  magrit.order_file_orphan_states(uuid[])
  to magrit_worker;
