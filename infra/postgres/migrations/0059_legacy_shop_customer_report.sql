create table public.legacy_shop_customer_migration_reports (
  legacy_tenant_id uuid not null references public.tenants(id) on delete cascade,
  legacy_user_id uuid not null,
  shop_id uuid,
  normalized_email text,
  proposed_action text not null check (proposed_action in (
    'create_delegated','matched_existing','skipped_no_shop','skipped_invalid_shop',
    'skipped_missing_email','skipped_invalid_email'
  )),
  target_account_id uuid,
  migration_outcome text check (migration_outcome is null or migration_outcome in (
    'created','matched_existing','skipped_no_shop','skipped_invalid_shop',
    'skipped_missing_email','skipped_invalid_email'
  )),
  orders_linked_count integer not null default 0 check (orders_linked_count>=0),
  last_attempt_at timestamptz,
  imported_at timestamptz not null default clock_timestamp(),
  unique nulls not distinct(legacy_tenant_id,legacy_user_id,shop_id)
);

alter table public.legacy_shop_customer_migration_reports enable row level security;
alter table public.legacy_shop_customer_migration_reports force row level security;
create policy legacy_shop_customer_reports_read
  on public.legacy_shop_customer_migration_reports for select to magrit_api using (
    legacy_tenant_id=magrit.current_tenant_id()
    and magrit.actor_has_capability(legacy_tenant_id,'can_manage_shop_customers')
  );
revoke all on table public.legacy_shop_customer_migration_reports from public;
grant select on table public.legacy_shop_customer_migration_reports to magrit_api;

create function magrit.import_legacy_shop_customer_migration_report(
  requested_tenant_id uuid,
  requested_legacy_user_id uuid,
  requested_shop_id uuid,
  requested_normalized_email text,
  requested_proposed_action text,
  requested_target_account_id uuid,
  requested_migration_outcome text,
  requested_orders_linked_count integer,
  requested_last_attempt_at timestamptz
)
returns void language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
begin
  if requested_proposed_action not in (
    'create_delegated','matched_existing','skipped_no_shop','skipped_invalid_shop',
    'skipped_missing_email','skipped_invalid_email'
  ) then raise exception using errcode='22023',message='legacy_customer_report_invalid_action'; end if;
  if requested_migration_outcome is not null and requested_migration_outcome not in (
    'created','matched_existing','skipped_no_shop','skipped_invalid_shop',
    'skipped_missing_email','skipped_invalid_email'
  ) then raise exception using errcode='22023',message='legacy_customer_report_invalid_outcome'; end if;
  if requested_orders_linked_count<0 then
    raise exception using errcode='22023',message='legacy_customer_report_invalid_order_count';
  end if;
  if not exists(select 1 from public.tenants tenant where tenant.id=requested_tenant_id) then
    raise exception using errcode='23503',message='legacy_customer_report_tenant_not_found';
  end if;
  insert into public.legacy_shop_customer_migration_reports(
    legacy_tenant_id,legacy_user_id,shop_id,normalized_email,proposed_action,
    target_account_id,migration_outcome,orders_linked_count,last_attempt_at
  ) values(
    requested_tenant_id,requested_legacy_user_id,requested_shop_id,requested_normalized_email,
    requested_proposed_action,requested_target_account_id,requested_migration_outcome,
    requested_orders_linked_count,requested_last_attempt_at
  ) on conflict(legacy_tenant_id,legacy_user_id,shop_id) do update set
    normalized_email=excluded.normalized_email,
    proposed_action=excluded.proposed_action,
    target_account_id=excluded.target_account_id,
    migration_outcome=excluded.migration_outcome,
    orders_linked_count=excluded.orders_linked_count,
    last_attempt_at=excluded.last_attempt_at,
    imported_at=clock_timestamp();
end $$;

revoke all on function magrit.import_legacy_shop_customer_migration_report(
  uuid,uuid,uuid,text,text,uuid,text,integer,timestamptz
) from public,magrit_api;

comment on table public.legacy_shop_customer_migration_reports is
  'Snapshot portable du contrôle UM7, importé avant retrait de auth.users et de Supabase.';
