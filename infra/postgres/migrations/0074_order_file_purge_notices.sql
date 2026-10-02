create table public.commercial_order_file_purge_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stage text not null check(stage in('first','second')),
  purge_at timestamptz not null,
  file_count integer not null check(file_count>=1),
  order_count integer not null check(order_count>=1),
  created_at timestamptz not null default clock_timestamp(),
  accepted_at timestamptz,
  confirmed_at timestamptz,
  failed_at timestamptz,
  last_error text
);
create index commercial_order_file_purge_notices_pending_idx
  on public.commercial_order_file_purge_notices(created_at)
  where confirmed_at is null and failed_at is null;

create table public.commercial_order_file_purge_notice_deliveries (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.commercial_order_file_purge_notices(id) on delete cascade,
  recipient_user_id uuid references public.app_users(id) on delete set null,
  recipient_email text not null check(btrim(recipient_email)<>''),
  provider_message_id text,
  accepted_at timestamptz,
  confirmed_at timestamptz,
  failed_at timestamptz,
  last_status text,
  check_attempts integer not null default 0 check(check_attempts>=0),
  next_check_at timestamptz not null default clock_timestamp(),
  unique(notice_id,recipient_email)
);
create index commercial_order_file_purge_deliveries_recheck_idx
  on public.commercial_order_file_purge_notice_deliveries(next_check_at)
  where accepted_at is not null and confirmed_at is null and failed_at is null;

alter table public.commercial_order_files
  add constraint commercial_order_files_purge_notice_1_fkey
  foreign key(purge_notice_1_id) references public.commercial_order_file_purge_notices(id),
  add constraint commercial_order_files_purge_notice_2_fkey
  foreign key(purge_notice_2_id) references public.commercial_order_file_purge_notices(id);

create function magrit.order_file_purge_notices_guard() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then
    if old.confirmed_at is null and old.failed_at is null then
      raise exception using errcode='42501',message='order_file_purge_notice.active_delete_forbidden';
    end if;
    return old;
  end if;
  if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
    or new.stage is distinct from old.stage or new.purge_at is distinct from old.purge_at
    or new.file_count is distinct from old.file_count or new.order_count is distinct from old.order_count
    or new.created_at is distinct from old.created_at then
    raise exception using errcode='42501',message='order_file_purge_notice.immutable';
  end if;
  return new;
end $$;
create trigger commercial_order_file_purge_notices_guard before update or delete
  on public.commercial_order_file_purge_notices for each row
  execute function magrit.order_file_purge_notices_guard();

create function magrit.order_file_purge_deliveries_guard() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then
    if old.confirmed_at is null and old.failed_at is null then
      raise exception using errcode='42501',message='order_file_purge_delivery.active_delete_forbidden';
    end if;
    return old;
  end if;
  if new.id is distinct from old.id or new.notice_id is distinct from old.notice_id
    or new.recipient_email is distinct from old.recipient_email then
    raise exception using errcode='42501',message='order_file_purge_delivery.immutable';
  end if;
  return new;
end $$;
create trigger commercial_order_file_purge_deliveries_guard before update or delete
  on public.commercial_order_file_purge_notice_deliveries for each row
  execute function magrit.order_file_purge_deliveries_guard();

alter table public.commercial_order_file_purge_notices enable row level security;
alter table public.commercial_order_file_purge_notices force row level security;
alter table public.commercial_order_file_purge_notice_deliveries enable row level security;
alter table public.commercial_order_file_purge_notice_deliveries force row level security;
create policy commercial_order_file_purge_notices_api_select
  on public.commercial_order_file_purge_notices for select to magrit_api
  using(tenant_id=magrit.current_tenant_id());
create policy commercial_order_file_purge_notices_worker
  on public.commercial_order_file_purge_notices for all to magrit_worker using(true) with check(true);
create policy commercial_order_file_purge_deliveries_api_select
  on public.commercial_order_file_purge_notice_deliveries for select to magrit_api
  using(exists(
    select 1 from public.commercial_order_file_purge_notices notice
     where notice.id=notice_id and notice.tenant_id=magrit.current_tenant_id()
  ));
create policy commercial_order_file_purge_deliveries_worker
  on public.commercial_order_file_purge_notice_deliveries for all to magrit_worker using(true) with check(true);
revoke all on public.commercial_order_file_purge_notices,
  public.commercial_order_file_purge_notice_deliveries from public;
grant select on public.commercial_order_file_purge_notices,
  public.commercial_order_file_purge_notice_deliveries to magrit_api;
grant select,insert,update,delete on public.commercial_order_file_purge_notices,
  public.commercial_order_file_purge_notice_deliveries to magrit_worker;

create function magrit.order_file_effective_purge_at(purge_at timestamptz,enabled_at timestamptz)
returns timestamptz language sql immutable as $$
  select case when enabled_at is null then null else greatest(purge_at,enabled_at+interval '30 days') end
$$;

create function magrit.resolve_order_file_purge_recipients(requested_tenant_id uuid)
returns table(recipient_user_id uuid,recipient_email text)
language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select member.user_id,user_account.email_normalized
    from public.tenant_members member
    join public.app_users user_account on user_account.id=member.user_id
   where member.tenant_id=requested_tenant_id and member.role in('owner','admin')
     and btrim(user_account.email_normalized)<>''
   order by case member.role when 'owner' then 0 else 1 end,user_account.email_normalized
$$;

create function magrit.order_file_purge_tenant_slug(requested_tenant_id uuid)
returns text language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select tenant.slug from public.tenants tenant where tenant.id=requested_tenant_id
$$;

create function magrit.claim_order_file_purge_notices(requested_stage text,requested_lead_days integer)
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
    insert into public.outbox_events(tenant_id,event_name,event_version,aggregate_type,aggregate_id,payload)
      values(selected_group.tenant_id,'order_files.purge_scheduled',1,'tenant',selected_group.tenant_id,
        jsonb_build_object('notice_id',created_notice_id,'stage',requested_stage,
          'file_count',selected_group.file_count,'order_count',selected_group.order_count,
          'purge_at',to_char(selected_group.effective_purge_at at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'days_before_purge',days_before,'order_ids',to_jsonb(selected_order_ids)));
    notice_id:=created_notice_id; tenant_id:=selected_group.tenant_id;
    file_count:=selected_group.file_count; order_count:=selected_group.order_count; return next;
  end loop;
end $$;

create function magrit.expire_order_file_purge_notices(requested_window_days integer default 3)
returns table(id uuid,tenant_id uuid,stage text)
language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare selected_id uuid; delivery_count integer; expired_notice public.commercial_order_file_purge_notices;
begin
  if requested_window_days<1 then raise exception using errcode='22023',message='order_file_purge.invalid_window'; end if;
  for selected_id in select notice.id from public.commercial_order_file_purge_notices notice
    where notice.confirmed_at is null and notice.failed_at is null
      and notice.created_at+make_interval(days=>requested_window_days)<=clock_timestamp()
    order by notice.created_at for update skip locked
  loop
    select count(*) into delivery_count from public.commercial_order_file_purge_notice_deliveries
      where notice_id=selected_id;
    update public.commercial_order_file_purge_notices notice
       set failed_at=clock_timestamp(),last_error=format(
         'order_file_purge_notice.delivery_window_expired: aucune livraison confirmee sous %s jour(s) (%s tentative(s))',
         requested_window_days,delivery_count)
     where notice.id=selected_id returning notice.* into expired_notice;
    update public.commercial_order_files set purge_notice_1_id=null where purge_notice_1_id=selected_id;
    update public.commercial_order_files set purge_notice_2_id=null where purge_notice_2_id=selected_id;
    id:=expired_notice.id; tenant_id:=expired_notice.tenant_id; stage:=expired_notice.stage; return next;
  end loop;
end $$;

create function magrit.record_order_file_purge_delivery_attempt(
  requested_notice_id uuid,requested_recipient_user_id uuid,requested_recipient_email text,
  requested_provider_message_id text
)
returns public.commercial_order_file_purge_notice_deliveries
language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare result public.commercial_order_file_purge_notice_deliveries;
begin
  insert into public.commercial_order_file_purge_notice_deliveries(
    notice_id,recipient_user_id,recipient_email,provider_message_id,accepted_at,failed_at,last_status)
  values(requested_notice_id,requested_recipient_user_id,requested_recipient_email,requested_provider_message_id,
    case when requested_provider_message_id is not null then clock_timestamp() end,
    case when requested_provider_message_id is null then clock_timestamp() end,
    case when requested_provider_message_id is null then 'send_failed' end)
  on conflict(notice_id,recipient_email) do update set
    recipient_user_id=excluded.recipient_user_id,provider_message_id=excluded.provider_message_id,
    accepted_at=excluded.accepted_at,failed_at=excluded.failed_at,last_status=excluded.last_status,
    check_attempts=0,next_check_at=clock_timestamp()
  where commercial_order_file_purge_notice_deliveries.confirmed_at is null;
  select * into result from public.commercial_order_file_purge_notice_deliveries
    where notice_id=requested_notice_id and recipient_email=requested_recipient_email;
  if not found then raise exception using errcode='P0002',message='order_file_purge_notice.not_found'; end if;
  if result.accepted_at is not null then
    update public.commercial_order_file_purge_notices set accepted_at=coalesce(accepted_at,clock_timestamp())
      where id=requested_notice_id;
  end if;
  return result;
end $$;

create function magrit.claim_order_file_purge_deliveries_for_check(requested_limit integer default 50)
returns table(delivery_id uuid,notice_id uuid,provider_message_id text)
language sql security invoker set search_path=pg_catalog,public,magrit as $$
  with candidates as materialized (
    select delivery.id from public.commercial_order_file_purge_notice_deliveries delivery
     where delivery.accepted_at is not null and delivery.confirmed_at is null and delivery.failed_at is null
       and delivery.provider_message_id is not null and delivery.check_attempts<20
       and delivery.next_check_at<=clock_timestamp()
     order by delivery.next_check_at limit greatest(requested_limit,0) for update skip locked
  ),claimed as (
    update public.commercial_order_file_purge_notice_deliveries delivery
       set check_attempts=delivery.check_attempts+1,next_check_at=clock_timestamp()+interval '4 hours'
      from candidates where delivery.id=candidates.id
    returning delivery.id,delivery.notice_id,delivery.provider_message_id
  ) select claimed.id,claimed.notice_id,claimed.provider_message_id from claimed
$$;

create function magrit.record_order_file_purge_delivery_check(requested_delivery_id uuid,requested_last_status text)
returns void language plpgsql security invoker set search_path=pg_catalog,public,magrit as $$
declare selected_notice_id uuid;
begin
  update public.commercial_order_file_purge_notice_deliveries delivery set
    last_status=requested_last_status,
    confirmed_at=case when requested_last_status='delivered' then coalesce(delivery.confirmed_at,clock_timestamp()) else delivery.confirmed_at end,
    failed_at=case when requested_last_status='bounced' then coalesce(delivery.failed_at,clock_timestamp()) else delivery.failed_at end
  where delivery.id=requested_delivery_id returning delivery.notice_id into selected_notice_id;
  if not found then raise exception using errcode='P0002',message='order_file_purge_delivery.not_found'; end if;
  if requested_last_status='delivered' then
    update public.commercial_order_file_purge_notices notice
       set confirmed_at=coalesce(notice.confirmed_at,clock_timestamp())
     where notice.id=selected_notice_id and notice.failed_at is null;
  end if;
end $$;

create function magrit.reset_stale_order_file_purge_notices()
returns integer language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare updated_count integer;
begin
  with candidates as materialized (
    select file.id,settings.order_file_purge_enabled_at enabled_at
      from public.commercial_order_files file
      join public.commercial_orders orders on orders.id=file.order_id
      join public.commercial_settings settings
        on settings.tenant_id=orders.tenant_id and settings.order_file_purge_enabled
      left join public.commercial_order_file_purge_notices first_notice on first_notice.id=file.purge_notice_1_id
      left join public.commercial_order_file_purge_notices second_notice on second_notice.id=file.purge_notice_2_id
     where file.deleted_at is null and file.purged_at is null and(
       (file.purge_notice_1_id is not null and first_notice.created_at<settings.order_file_purge_enabled_at)
       or(file.purge_notice_2_id is not null and second_notice.created_at<settings.order_file_purge_enabled_at))
     for update of file skip locked
  ),updated as (
    update public.commercial_order_files file set
      purge_notice_1_id=case when exists(select 1 from public.commercial_order_file_purge_notices notice
        where notice.id=file.purge_notice_1_id and notice.created_at<candidates.enabled_at) then null else file.purge_notice_1_id end,
      purge_notice_2_id=case when exists(select 1 from public.commercial_order_file_purge_notices notice
        where notice.id=file.purge_notice_2_id and notice.created_at<candidates.enabled_at) then null else file.purge_notice_2_id end
    from candidates where file.id=candidates.id returning file.id
  ) select count(*) into updated_count from updated;
  return updated_count;
end $$;

revoke all on function magrit.resolve_order_file_purge_recipients(uuid),
  magrit.order_file_purge_tenant_slug(uuid),
  magrit.claim_order_file_purge_notices(text,integer),magrit.expire_order_file_purge_notices(integer),
  magrit.record_order_file_purge_delivery_attempt(uuid,uuid,text,text),
  magrit.claim_order_file_purge_deliveries_for_check(integer),
  magrit.record_order_file_purge_delivery_check(uuid,text),
  magrit.reset_stale_order_file_purge_notices()
  from public,magrit_api,magrit_readonly;
grant execute on function magrit.resolve_order_file_purge_recipients(uuid),
  magrit.order_file_purge_tenant_slug(uuid),
  magrit.claim_order_file_purge_notices(text,integer),magrit.expire_order_file_purge_notices(integer),
  magrit.record_order_file_purge_delivery_attempt(uuid,uuid,text,text),
  magrit.claim_order_file_purge_deliveries_for_check(integer),
  magrit.record_order_file_purge_delivery_check(uuid,text),
  magrit.reset_stale_order_file_purge_notices()
  to magrit_worker;
