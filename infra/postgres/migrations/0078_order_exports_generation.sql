create or replace function magrit.actor_has_capability(requested_tenant_id uuid,requested_capability text)
returns boolean language sql stable security definer set search_path=pg_catalog,public,magrit as $$
  select (
    requested_capability = any(array[
      'can_manage_pricing','can_manage_notifications','can_manage_production_steps',
      'can_manage_document_templates','can_manage_members','can_invite',
      'can_manage_shop_customers','can_impersonate_shop_customer','can_export_orders'
    ]::text[])
    or exists (
      select 1 from public.tenant_role_definitions known
       where known.tenant_id=requested_tenant_id and known.archived_at is null
         and known.capabilities ? requested_capability
    )
  ) and coalesce(
    exists(select 1 from public.user_preferences p where p.user_id=magrit.current_user_id() and p.is_admin)
    or exists(
      select 1 from public.tenant_members m
       where m.user_id=magrit.current_user_id() and m.tenant_id=requested_tenant_id
         and(m.role in('owner','admin')
           or(requested_capability='can_invite' and m.permissions @> '{"can_invite":true}'::jsonb))
    )
    or exists(
      select 1 from public.tenant_role_assignments a
      join public.tenant_role_definitions d on d.id=a.role_definition_id
      where a.user_id=magrit.current_user_id() and a.revoked_at is null and d.archived_at is null
        and d.tenant_id=requested_tenant_id
        and d.capabilities @> jsonb_build_object(requested_capability,true)
    ),false)
$$;

create table public.commercial_order_exports(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'pending' check(status in('pending','running','ready','failed','expired')),
  format text not null check(format in('xlsx','csv')),
  granularity text not null check(granularity in('order','line')),
  filters jsonb not null default '{}'::jsonb check(jsonb_typeof(filters)='object'),
  layout_version integer not null default 1 check(layout_version=1),
  requested_by uuid references public.app_users(id) on delete set null,
  requested_by_label text,
  requested_at timestamptz not null default clock_timestamp(),
  started_at timestamptz,completed_at timestamptz,
  row_count bigint check(row_count>=0),storage_path text,file_name text,
  byte_size bigint check(byte_size>=1),sha256 text check(sha256~'^[0-9a-f]{64}$'),
  content_type text check(content_type in(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv')),
  expires_at timestamptz,
  attempts integer not null default 0 check(attempts>=0),
  next_attempt_at timestamptz not null default clock_timestamp(),
  error_code text,error_detail text,
  purge_attempts integer not null default 0 check(purge_attempts>=0)
);
create index commercial_order_exports_tenant_requested_idx
  on public.commercial_order_exports(tenant_id,requested_at desc,id desc);
create index commercial_order_exports_pending_due_idx
  on public.commercial_order_exports(next_attempt_at) where status='pending';
create index commercial_order_exports_requester_open_idx
  on public.commercial_order_exports(tenant_id,requested_by) where status in('pending','running');
create index commercial_order_exports_expiring_idx
  on public.commercial_order_exports(expires_at) where status in('ready','expired');
create unique index commercial_order_exports_storage_path_uidx
  on public.commercial_order_exports(storage_path) where storage_path is not null;

create function magrit.commercial_order_exports_guard() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then
    if not exists(select 1 from public.tenants where id=old.tenant_id) then return old; end if;
    raise exception using errcode='42501',message='commercial_order_exports_immutable';
  end if;
  if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
    or new.format is distinct from old.format or new.granularity is distinct from old.granularity
    or new.filters is distinct from old.filters or new.layout_version is distinct from old.layout_version
    or(new.requested_by is distinct from old.requested_by
      and not(old.requested_by is not null and new.requested_by is null))
    or new.requested_by_label is distinct from old.requested_by_label
    or new.requested_at is distinct from old.requested_at then
    raise exception using errcode='42501',message='commercial_order_exports_immutable';
  end if;
  if old.status='expired' and new.status is distinct from 'expired'
    or old.status='failed' and new.status is distinct from 'failed'
    or old.status='ready' and new.status not in('ready','expired') then
    raise exception using errcode='42501',message='commercial_order_exports_status_terminal';
  end if;
  return new;
end $$;
create trigger commercial_order_exports_guard before update or delete
  on public.commercial_order_exports for each row execute function magrit.commercial_order_exports_guard();

alter table public.commercial_order_exports enable row level security;
alter table public.commercial_order_exports force row level security;
create policy commercial_order_exports_select on public.commercial_order_exports for select to magrit_api
  using(tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_export_orders'));
revoke all on table public.commercial_order_exports from public;
grant select on table public.commercial_order_exports to magrit_api;

create view magrit.commercial_order_export_headers as
select o.tenant_id,o.id order_id,o.number order_number,q.number quote_number,o.created_at order_created_at,
  c.type customer_type,case when c.type='company' then c.company_name
    else btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')) end customer_name,
  c.siret customer_siret,c.vat_number customer_vat_number,
  case when cc.id is null then null else btrim(coalesce(cc.first_name,'')||' '||coalesce(cc.last_name,'')) end customer_contact_name,
  cc.email customer_contact_email,o.status order_status,ps.label production_step_label,
  o.lines_subtotal,o.global_discount,o.effective_discount_rate,o.net_total,o.vat_rate,o.vat_regime,
  o.vat_amount,o.total_incl_tax
from public.commercial_orders o
join public.customers c on c.id=o.customer_id
join public.commercial_quotes q on q.id=o.quote_id
left join public.customer_contacts cc on cc.id=o.customer_contact_id
left join public.production_steps ps on ps.id=o.current_production_step_id;

create view magrit.commercial_order_export_lines as
select o.tenant_id,o.id order_id,l.id line_id,o.number order_number,q.number quote_number,
  o.created_at order_created_at,c.type customer_type,
  case when c.type='company' then c.company_name
    else btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')) end customer_name,
  c.siret customer_siret,c.vat_number customer_vat_number,
  case when cc.id is null then null else btrim(coalesce(cc.first_name,'')||' '||coalesce(cc.last_name,'')) end customer_contact_name,
  cc.email customer_contact_email,o.status order_status,ps.label production_step_label,
  l.position line_position,l.label line_label,l.quantity,l.customer_price bracket_amount_excl_tax,
  l.discount_rate,round(l.sale_price/l.quantity,4) unit_price_indicative,l.sale_price
from public.commercial_order_lines l
join public.commercial_orders o on o.id=l.order_id
join public.customers c on c.id=o.customer_id
join public.commercial_quotes q on q.id=o.quote_id
left join public.customer_contacts cc on cc.id=o.customer_contact_id
left join public.production_steps ps on ps.id=o.current_production_step_id;
revoke all on magrit.commercial_order_export_headers,magrit.commercial_order_export_lines from public;

create function magrit.request_order_export(
  requested_tenant_id uuid,requested_format text,requested_granularity text,requested_filters jsonb
) returns uuid language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare actor_id uuid:=magrit.current_user_id();export_id uuid;actor_label text;
begin
  if actor_id is null then raise exception using errcode='28000',message='authentication_required'; end if;
  if requested_tenant_id is distinct from magrit.current_tenant_id()
    or not magrit.actor_has_capability(requested_tenant_id,'can_export_orders') then
    raise exception using errcode='42501',message='permission_denied';
  end if;
  if requested_format not in('xlsx','csv') or requested_granularity not in('order','line')
    or jsonb_typeof(coalesce(requested_filters,'{}'::jsonb))<>'object' then
    raise exception using errcode='22023',message='order_export.invalid_request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('order-export:'||requested_tenant_id||':'||actor_id,0));
  if(select count(*) from public.commercial_order_exports
      where tenant_id=requested_tenant_id and requested_by=actor_id and status in('pending','running'))>=3 then
    raise exception using errcode='P0001',message='order_export.pending_limit_reached';
  end if;
  select coalesce(nullif(btrim(display_name),''),email_normalized) into actor_label
    from public.app_users where id=actor_id;
  insert into public.commercial_order_exports(
    tenant_id,format,granularity,filters,requested_by,requested_by_label
  ) values(requested_tenant_id,requested_format,requested_granularity,
    coalesce(requested_filters,'{}'::jsonb),actor_id,actor_label) returning id into export_id;
  return export_id;
end $$;

create function magrit.claim_order_exports(requested_limit integer,requested_max_attempts integer,requested_max_age_seconds integer)
returns table(id uuid,tenant_id uuid,format text,granularity text,filters jsonb)
language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
begin
  with stuck as(
    select export.id from public.commercial_order_exports export
     where export.status='running' and export.started_at<clock_timestamp()-interval '15 minutes'
     for update skip locked)
  update public.commercial_order_exports export set status='failed',completed_at=clock_timestamp(),
    error_code='order_export.generation_failed',error_detail='order_export_interrupted: worker interrompu avant verdict'
   from stuck where export.id=stuck.id;
  return query
  with candidates as materialized(
    select export.id,export.requested_at,export.attempts
      from public.commercial_order_exports export
     where export.status='pending' and export.attempts<requested_max_attempts
       and export.next_attempt_at<=clock_timestamp()
     order by export.requested_at limit greatest(requested_limit,0) for update skip locked),
  stale as(
    update public.commercial_order_exports export set status='failed',attempts=requested_max_attempts,
      completed_at=clock_timestamp(),error_code='order_export.generation_failed',
      error_detail='order_export_stale: demande trop ancienne'
    from candidates where export.id=candidates.id
      and candidates.requested_at<clock_timestamp()-make_interval(secs=>requested_max_age_seconds)
    returning export.id),
  claimed as(
    update public.commercial_order_exports export set status='running',attempts=export.attempts+1,
      started_at=clock_timestamp(),next_attempt_at=clock_timestamp()
        +power(5,least(export.attempts+1,requested_max_attempts)-1)::numeric*interval '1 minute'
    from candidates where export.id=candidates.id and not exists(select 1 from stale where stale.id=export.id)
    returning export.id,export.tenant_id,export.format,export.granularity,export.filters)
  select claimed.id,claimed.tenant_id,claimed.format,claimed.granularity,claimed.filters from claimed;
end $$;

create function magrit.read_order_export_rows(requested_export_id uuid,requested_after jsonb,requested_limit integer)
returns table(cursor jsonb,payload jsonb)
language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare export_row public.commercial_order_exports;filter_customer uuid;filter_quote uuid;filter_step uuid;
  filter_status text;filter_from date;filter_to date;after_created timestamptz;after_number text;after_position integer;
begin
  select * into export_row from public.commercial_order_exports where id=requested_export_id and status='running';
  if not found then return; end if;
  filter_customer:=nullif(export_row.filters->>'customer_id','')::uuid;
  filter_quote:=nullif(export_row.filters->>'quote_id','')::uuid;
  filter_step:=nullif(export_row.filters->>'current_production_step_id','')::uuid;
  filter_status:=nullif(export_row.filters->>'status','');
  filter_from:=nullif(export_row.filters->>'created_from','')::date;
  filter_to:=nullif(export_row.filters->>'created_to','')::date;
  if requested_after is not null then
    after_created:=(requested_after->>'order_created_at')::timestamptz;
    after_number:=requested_after->>'order_number';
    after_position:=nullif(requested_after->>'line_position','')::integer;
  end if;
  if export_row.granularity='order' then return query
    select jsonb_build_object('order_created_at',h.order_created_at,'order_number',h.order_number),
      jsonb_build_object('order_number',h.order_number,'quote_number',h.quote_number,
        'order_created_at',to_jsonb(h.order_created_at),'customer_type',h.customer_type,
        'customer_name',h.customer_name,'customer_siret',h.customer_siret,
        'customer_vat_number',h.customer_vat_number,'customer_contact_name',h.customer_contact_name,
        'customer_contact_email',h.customer_contact_email,'order_status',h.order_status,
        'production_step_label',h.production_step_label,'lines_subtotal',h.lines_subtotal::text,
        'global_discount',h.global_discount::text,'effective_discount_rate',h.effective_discount_rate::text,
        'net_total',h.net_total::text,'vat_rate',h.vat_rate::text,'vat_regime',h.vat_regime,
        'vat_amount',h.vat_amount::text,'total_incl_tax',h.total_incl_tax::text)
    from magrit.commercial_order_export_headers h join public.commercial_orders orders on orders.id=h.order_id
    where h.tenant_id=export_row.tenant_id and(filter_customer is null or orders.customer_id=filter_customer)
      and(filter_quote is null or orders.quote_id=filter_quote) and(filter_step is null or orders.current_production_step_id=filter_step)
      and(filter_status is null or h.order_status=filter_status)
      and(filter_from is null or h.order_created_at>=filter_from::timestamp at time zone 'Europe/Paris')
      and(filter_to is null or h.order_created_at<(filter_to+1)::timestamp at time zone 'Europe/Paris')
      and(requested_after is null or(h.order_created_at,h.order_number)>(after_created,after_number))
    order by h.order_created_at,h.order_number limit greatest(requested_limit,0);
  else return query
    select jsonb_build_object('order_created_at',l.order_created_at,'order_number',l.order_number,'line_position',l.line_position),
      jsonb_build_object('order_number',l.order_number,'quote_number',l.quote_number,
        'order_created_at',to_jsonb(l.order_created_at),'customer_type',l.customer_type,
        'customer_name',l.customer_name,'customer_siret',l.customer_siret,
        'customer_vat_number',l.customer_vat_number,'customer_contact_name',l.customer_contact_name,
        'customer_contact_email',l.customer_contact_email,'order_status',l.order_status,
        'production_step_label',l.production_step_label,'line_position',l.line_position,
        'line_label',l.line_label,'quantity',l.quantity,'bracket_amount_excl_tax',l.bracket_amount_excl_tax::text,
        'discount_rate',l.discount_rate::text,'unit_price_indicative',l.unit_price_indicative::text,
        'sale_price',l.sale_price::text)
    from magrit.commercial_order_export_lines l join public.commercial_orders orders on orders.id=l.order_id
    where l.tenant_id=export_row.tenant_id and(filter_customer is null or orders.customer_id=filter_customer)
      and(filter_quote is null or orders.quote_id=filter_quote) and(filter_step is null or orders.current_production_step_id=filter_step)
      and(filter_status is null or l.order_status=filter_status)
      and(filter_from is null or l.order_created_at>=filter_from::timestamp at time zone 'Europe/Paris')
      and(filter_to is null or l.order_created_at<(filter_to+1)::timestamp at time zone 'Europe/Paris')
      and(requested_after is null or(l.order_created_at,l.order_number,l.line_position)>(after_created,after_number,after_position))
    order by l.order_created_at,l.order_number,l.line_position limit greatest(requested_limit,0);
  end if;
end $$;

create function magrit.mark_order_export_ready(
  requested_id uuid,requested_row_count bigint,requested_storage_path text,requested_file_name text,
  requested_byte_size bigint,requested_sha256 text,requested_content_type text,
  requested_completed_at timestamptz,requested_expires_at timestamptz
) returns void language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
begin
  update public.commercial_order_exports set status='ready',row_count=requested_row_count,
    storage_path=requested_storage_path,file_name=requested_file_name,byte_size=requested_byte_size,
    sha256=requested_sha256,content_type=requested_content_type,completed_at=requested_completed_at,
    expires_at=requested_expires_at,error_code=null,error_detail=null where id=requested_id and status='running';
  if not found then raise exception using errcode='55000',message='order_export.not_running'; end if;
end $$;

create function magrit.mark_order_export_failed(requested_id uuid,requested_code text,requested_detail text,requested_completed_at timestamptz)
returns void language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
begin
  update public.commercial_order_exports set status='failed',error_code=requested_code,
    error_detail=left(requested_detail,2000),completed_at=requested_completed_at
    where id=requested_id and status='running';
  if not found then raise exception using errcode='55000',message='order_export.not_running'; end if;
end $$;

revoke all on function magrit.request_order_export(uuid,text,text,jsonb),
  magrit.claim_order_exports(integer,integer,integer),magrit.read_order_export_rows(uuid,jsonb,integer),
  magrit.mark_order_export_ready(uuid,bigint,text,text,bigint,text,text,timestamptz,timestamptz),
  magrit.mark_order_export_failed(uuid,text,text,timestamptz) from public,magrit_api,magrit_readonly;
grant execute on function magrit.request_order_export(uuid,text,text,jsonb) to magrit_api;
grant execute on function magrit.claim_order_exports(integer,integer,integer),
  magrit.read_order_export_rows(uuid,jsonb,integer),
  magrit.mark_order_export_ready(uuid,bigint,text,text,bigint,text,text,timestamptz,timestamptz),
  magrit.mark_order_export_failed(uuid,text,text,timestamptz) to magrit_worker;
