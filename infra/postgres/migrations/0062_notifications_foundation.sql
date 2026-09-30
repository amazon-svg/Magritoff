create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_name text not null check(event_name in('quote.sent','quote.converted','order.step_changed','order.files_submitted','customer.created')),
  channel text not null check(channel in('email','sms')),
  audience text not null check(audience in('customer','explicit')),
  recipients text[],
  production_step_id uuid references public.production_steps(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 120),
  subject text,
  body text not null check(char_length(body) between 1 and 4000),
  is_active boolean not null default false,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_by uuid references public.app_users(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  constraint notification_templates_recipients_coherence check(
    (audience='explicit' and recipients is not null and array_length(recipients,1) between 1 and 10)
    or(audience='customer' and recipients is null)
  ),
  constraint notification_templates_step_filter_coherence check(production_step_id is null or event_name='order.step_changed'),
  constraint notification_templates_subject_coherence check(
    (channel='email' and subject is not null and char_length(subject) between 1 and 200)
    or(channel='sms' and subject is null)
  ),
  constraint notification_templates_sms_body_length check(channel<>'sms' or char_length(body)<=480)
);
create index notification_templates_tenant_event_idx on public.notification_templates(tenant_id,event_name,name);

create function magrit.notification_templates_guard() returns trigger language plpgsql as $$
declare template_count integer;
begin
  if tg_op='INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('notification_templates:'||new.tenant_id::text,0));
    select count(*) into template_count from public.notification_templates where tenant_id=new.tenant_id;
    if template_count>=100 then raise exception using errcode='23514',message='notification_template.limit_reached'; end if;
    new.created_by:=coalesce(new.created_by,magrit.current_user_id());
    new.updated_by:=magrit.current_user_id();
  else
    if new.event_name is distinct from old.event_name or new.channel is distinct from old.channel then
      raise exception using errcode='23514',message='notification_template.immutable_field';
    end if;
    new.created_by:=old.created_by; new.created_at:=old.created_at; new.updated_by:=magrit.current_user_id();
  end if;
  if new.production_step_id is not null and not exists(
    select 1 from public.production_steps step where step.id=new.production_step_id and step.tenant_id=new.tenant_id
  ) then raise exception using errcode='23514',message='notification_template.step_tenant_mismatch'; end if;
  new.updated_at:=clock_timestamp(); return new;
end $$;
create trigger notification_templates_guard before insert or update on public.notification_templates
for each row execute function magrit.notification_templates_guard();

alter table public.notification_templates enable row level security;
alter table public.notification_templates force row level security;
create policy notification_templates_select on public.notification_templates for select to magrit_api
  using(tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id));
create policy notification_templates_insert on public.notification_templates for insert to magrit_api
  with check(tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_notifications'));
create policy notification_templates_update on public.notification_templates for update to magrit_api
  using(tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_notifications'))
  with check(tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_notifications'));
revoke all on table public.notification_templates from public;
grant select,insert,update on table public.notification_templates to magrit_api;

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_id uuid not null,
  event_name text not null check(event_name in('quote.sent','quote.converted','order.step_changed','order.files_submitted','customer.created')),
  aggregate_type text not null,
  aggregate_id uuid not null,
  template_id uuid references public.notification_templates(id) on delete set null,
  channel text not null check(channel in('email','sms')),
  status text not null default 'pending' check(status in('pending','sent','failed','dropped')),
  recipient text,
  subject text,
  body text not null,
  attempts integer not null default 0 check(attempts>=0),
  occurrence_count integer not null default 1 check(occurrence_count>=1),
  coalescing_window_minutes integer not null default 0 check(coalescing_window_minutes between 0 and 120),
  next_attempt_at timestamptz not null default clock_timestamp(),
  provider_message_id text,
  last_error text,
  deferred_render jsonb,
  created_at timestamptz not null default clock_timestamp(),
  sent_at timestamptz,
  constraint notification_logs_recipient_shape check(
    (status='dropped' and recipient is null) or(status<>'dropped' and recipient is not null)
  ),
  constraint notification_logs_subject_shape check(channel<>'sms' or subject is null)
);
create index notification_logs_tenant_created_idx on public.notification_logs(tenant_id,created_at desc);
create index notification_logs_pending_due_idx on public.notification_logs(next_attempt_at) where status='pending';
create unique index notification_logs_dedupe_uidx on public.notification_logs(event_id,template_id,(coalesce(recipient,'')));
create unique index notification_logs_grouping_uidx on public.notification_logs(template_id,aggregate_id,(coalesce(recipient,'')))
  where status='pending' and coalescing_window_minutes>0 and attempts=0;

create function magrit.notification_logs_reject_mutation() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then return old; end if;
  if new.status='pending' and old.status is distinct from 'pending' then
    raise exception using errcode='42501',message='notification_logs_immutable: terminal status cannot become pending';
  end if;
  if new.id is distinct from old.id or new.tenant_id is distinct from old.tenant_id
    or new.event_id is distinct from old.event_id or new.event_name is distinct from old.event_name
    or new.aggregate_type is distinct from old.aggregate_type or new.aggregate_id is distinct from old.aggregate_id
    or(new.template_id is distinct from old.template_id and not(old.template_id is not null and new.template_id is null))
    or new.channel is distinct from old.channel or new.recipient is distinct from old.recipient
    or(new.subject is distinct from old.subject and not(old.status='pending' and new.status is distinct from 'pending'))
    or(new.body is distinct from old.body and not(old.status='pending' and new.status is distinct from 'pending'))
    or(new.deferred_render is distinct from old.deferred_render and not(old.deferred_render is not null and new.deferred_render is null))
    or new.created_at is distinct from old.created_at then
    raise exception using errcode='42501',message='notification_logs_immutable: message content is sealed';
  end if;
  return new;
end $$;
create trigger notification_logs_append_only before update or delete on public.notification_logs
for each row execute function magrit.notification_logs_reject_mutation();

alter table public.notification_logs enable row level security;
alter table public.notification_logs force row level security;
create policy notification_logs_api_select on public.notification_logs for select to magrit_api
  using(tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id));
create policy notification_logs_worker on public.notification_logs for all to magrit_worker using(true) with check(true);
revoke all on table public.notification_logs from public;
grant select on table public.notification_logs to magrit_api;
grant select,insert,update,delete on table public.notification_logs to magrit_worker;

create function magrit.enqueue_notification_message(
  requested_tenant_id uuid,requested_event_id uuid,requested_event_name text,
  requested_aggregate_type text,requested_aggregate_id uuid,requested_template_id uuid,
  requested_channel text,requested_status text,requested_recipient text,requested_subject text,
  requested_body text,requested_last_error text default null,
  requested_coalescing_window_minutes integer default 0,requested_deferred_render jsonb default null
) returns public.notification_logs language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
declare existing public.notification_logs; grouped public.notification_logs; result public.notification_logs;
begin
  if not exists(select 1 from public.notification_templates template where template.id=requested_template_id and template.tenant_id=requested_tenant_id) then
    raise exception using errcode='23514',message='notification_template.tenant_mismatch';
  end if;
  select * into existing from public.notification_logs where event_id=requested_event_id
    and template_id=requested_template_id and coalesce(recipient,'')=coalesce(requested_recipient,'') limit 1;
  if found then return existing; end if;
  if requested_status='pending' and requested_coalescing_window_minutes>0 then
    select * into grouped from public.notification_logs where template_id=requested_template_id
      and aggregate_id=requested_aggregate_id and coalesce(recipient,'')=coalesce(requested_recipient,'')
      and status='pending' and coalescing_window_minutes>0 and attempts=0 for update limit 1;
    if found then
      update public.notification_logs set occurrence_count=occurrence_count+1 where id=grouped.id returning * into result;
      return result;
    end if;
  end if;
  insert into public.notification_logs(tenant_id,event_id,event_name,aggregate_type,aggregate_id,template_id,
    channel,status,recipient,subject,body,last_error,coalescing_window_minutes,next_attempt_at,deferred_render)
  values(requested_tenant_id,requested_event_id,requested_event_name,requested_aggregate_type,requested_aggregate_id,
    requested_template_id,requested_channel,requested_status,requested_recipient,requested_subject,requested_body,
    requested_last_error,requested_coalescing_window_minutes,
    clock_timestamp()+make_interval(mins=>requested_coalescing_window_minutes),requested_deferred_render)
  returning * into result;
  return result;
exception when unique_violation then
  select * into result from public.notification_logs where event_id=requested_event_id
    and template_id=requested_template_id and coalesce(recipient,'')=coalesce(requested_recipient,'') limit 1;
  if found then return result; end if;
  select * into result from public.notification_logs where template_id=requested_template_id
    and aggregate_id=requested_aggregate_id and coalesce(recipient,'')=coalesce(requested_recipient,'')
    and status='pending' and coalescing_window_minutes>0 and attempts=0 limit 1;
  return result;
end $$;
revoke all on function magrit.enqueue_notification_message(uuid,uuid,text,text,uuid,uuid,text,text,text,text,text,text,integer,jsonb)
  from public,magrit_api,magrit_readonly;
grant execute on function magrit.enqueue_notification_message(uuid,uuid,text,text,uuid,uuid,text,text,text,text,text,text,integer,jsonb)
  to magrit_worker;

comment on table public.notification_templates is 'Configuration portable des notifications, sans dépendance auth.users.';
comment on table public.notification_logs is 'File et journal portables des notifications ; contenu scellé, suivi mutable.';
