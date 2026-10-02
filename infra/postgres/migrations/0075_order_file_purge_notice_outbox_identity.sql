create or replace function magrit.claim_order_file_purge_notices(requested_stage text,requested_lead_days integer)
returns table(notice_id uuid,tenant_id uuid,file_count integer,order_count integer)
language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare selected_group record; created_notice_id uuid; days_before integer; selected_order_ids uuid[];
begin
  if requested_stage not in('first','second') then
    raise exception using errcode='22023',message='order_file_purge.invalid_stage';
  end if;
  if requested_lead_days<0 then
    raise exception using errcode='22023',message='order_file_purge.invalid_lead_days';
  end if;
  for selected_group in
    with candidates as materialized (
      select file.id,file.order_id,
             magrit.order_file_effective_purge_at(file.purge_at,settings.order_file_purge_enabled_at) effective_purge_at,
             orders.tenant_id
        from public.commercial_order_files file
        join public.commercial_orders orders on orders.id=file.order_id
        join public.commercial_settings settings
          on settings.tenant_id=orders.tenant_id and settings.order_file_purge_enabled
       where file.deleted_at is null and file.purged_at is null
         and magrit.order_file_effective_purge_at(file.purge_at,settings.order_file_purge_enabled_at)
             - make_interval(days=>requested_lead_days)<=clock_timestamp()
         and (case requested_stage when 'first' then file.purge_notice_1_id else file.purge_notice_2_id end) is null
       order by file.id for update of file skip locked
    )
    select candidates.tenant_id,candidates.effective_purge_at,array_agg(candidates.id) file_ids,
           count(*)::integer file_count,count(distinct candidates.order_id)::integer order_count,
           array_agg(distinct candidates.order_id) order_ids
      from candidates group by candidates.tenant_id,candidates.effective_purge_at
      order by candidates.tenant_id,candidates.effective_purge_at
  loop
    if not exists(select 1 from magrit.resolve_order_file_purge_recipients(selected_group.tenant_id)) then
      continue;
    end if;
    days_before:=greatest(0,ceil(extract(epoch from(selected_group.effective_purge_at-clock_timestamp()))/86400.0))::integer;
    selected_order_ids:=(select coalesce(array_agg(value),array[]::uuid[])
      from(select unnest(selected_group.order_ids) value limit 50) limited);
    insert into public.commercial_order_file_purge_notices(tenant_id,stage,purge_at,file_count,order_count)
      values(selected_group.tenant_id,requested_stage,selected_group.effective_purge_at,
             selected_group.file_count,selected_group.order_count)
      returning id into created_notice_id;
    execute format('update public.commercial_order_files set %I=$1 where id=any($2)',
      case requested_stage when 'first' then 'purge_notice_1_id' else 'purge_notice_2_id' end)
      using created_notice_id,selected_group.file_ids;
    insert into public.outbox_events(
      id,tenant_id,event_name,event_version,aggregate_type,aggregate_id,payload,occurred_at
    ) values(
      gen_random_uuid(),selected_group.tenant_id,'order_files.purge_scheduled',1,'tenant',selected_group.tenant_id,
      jsonb_build_object('notice_id',created_notice_id,'stage',requested_stage,
        'file_count',selected_group.file_count,'order_count',selected_group.order_count,
        'purge_at',to_char(selected_group.effective_purge_at at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'days_before_purge',days_before,'order_ids',to_jsonb(selected_order_ids)),clock_timestamp()
    );
    notice_id:=created_notice_id; tenant_id:=selected_group.tenant_id;
    file_count:=selected_group.file_count; order_count:=selected_group.order_count; return next;
  end loop;
end $$;
