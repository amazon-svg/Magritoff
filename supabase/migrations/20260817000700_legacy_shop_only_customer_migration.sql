-- UM7.1 — Migration additive des anciens membres `shop_only` vers les comptes
-- storefront isolés par boutique.
--
-- L'ancien membre et son utilisateur Auth sont volontairement conservés. Un
-- même auth.users.id ne peut pas être partagé entre plusieurs boutiques dans
-- le nouveau modèle : les comptes créés restent donc `delegated_only`, sans
-- auth_subject_id, jusqu'à leur activation indépendante.

create table if not exists private.legacy_shop_customer_migrations (
  id uuid primary key default gen_random_uuid(),
  legacy_tenant_id uuid not null,
  legacy_user_id uuid not null,
  shop_id uuid,
  source_email text,
  target_account_id uuid references public.shop_customer_accounts(id) on delete set null,
  outcome text not null,
  orders_linked_count integer not null default 0,
  migrated_at timestamptz not null default clock_timestamp(),
  last_attempt_at timestamptz not null default clock_timestamp(),
  constraint legacy_shop_customer_migrations_outcome_check check (
    outcome in (
      'created', 'matched_existing', 'skipped_no_shop',
      'skipped_invalid_shop', 'skipped_missing_email', 'skipped_invalid_email'
    )
  ),
  constraint legacy_shop_customer_migrations_source_unique
    unique nulls not distinct (legacy_tenant_id, legacy_user_id, shop_id)
);

alter table private.legacy_shop_customer_migrations enable row level security;
revoke all on table private.legacy_shop_customer_migrations from public, anon, authenticated;

create or replace view private.legacy_shop_customer_migration_plan as
with legacy_members as (
  select
    tm.tenant_id,
    tm.user_id,
    nullif(lower(btrim(u.email)), '') as normalized_email,
    left(coalesce(
      nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data->>'name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'Client migré'
    ), 200) as full_name,
    candidate.shop_id
  from public.tenant_members tm
  join auth.users u on u.id = tm.user_id
  cross join lateral unnest(
    case
      when cardinality(coalesce(tm.allowed_shop_ids, '{}')) = 0
        then array[null::uuid]
      else tm.allowed_shop_ids
    end
  ) candidate(shop_id)
  where tm.access_scope = 'shop_only'
)
select
  legacy.tenant_id as legacy_tenant_id,
  legacy.user_id as legacy_user_id,
  legacy.shop_id,
  legacy.normalized_email,
  legacy.full_name,
  account.id as existing_account_id,
  case
    when legacy.shop_id is null then 'skipped_no_shop'
    when legacy.normalized_email is null then 'skipped_missing_email'
    when length(legacy.normalized_email) not between 3 and 320
      or position('@' in legacy.normalized_email) <= 1 then 'skipped_invalid_email'
    when shop.id is null then 'skipped_invalid_shop'
    when account.id is not null then 'matched_existing'
    else 'create_delegated'
  end as proposed_action
from legacy_members legacy
left join public.shops shop
  on shop.id = legacy.shop_id
 and shop.tenant_id = legacy.tenant_id
left join public.shop_customer_accounts account
  on account.shop_id = legacy.shop_id
 and account.normalized_email = legacy.normalized_email;

revoke all on private.legacy_shop_customer_migration_plan from public, anon, authenticated;

create or replace function private.migrate_legacy_shop_customers(p_tenant_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_plan record;
  v_account_id uuid;
  v_inserted_account_id uuid;
  v_outcome text;
  v_orders_linked integer;
  v_processed integer := 0;
  v_created integer := 0;
  v_matched integer := 0;
  v_skipped integer := 0;
  v_total_orders_linked integer := 0;
begin
  for v_plan in
    select *
      from private.legacy_shop_customer_migration_plan plan
     where p_tenant_id is null or plan.legacy_tenant_id = p_tenant_id
     order by plan.legacy_tenant_id, plan.legacy_user_id, plan.shop_id
  loop
    v_processed := v_processed + 1;
    v_account_id := v_plan.existing_account_id;
    v_inserted_account_id := null;
    v_orders_linked := 0;

    if v_plan.proposed_action = 'create_delegated' then
      insert into public.shop_customer_accounts (
        shop_id, email, full_name, auth_subject_id, status
      ) values (
        v_plan.shop_id, v_plan.normalized_email, v_plan.full_name, null, 'delegated_only'
      )
      on conflict on constraint shop_customer_accounts_shop_email_unique do nothing
      returning id into v_inserted_account_id;

      if v_inserted_account_id is not null then
        v_account_id := v_inserted_account_id;
        v_outcome := 'created';
        v_created := v_created + 1;
      else
        select account.id into v_account_id
          from public.shop_customer_accounts account
         where account.shop_id = v_plan.shop_id
           and account.normalized_email = v_plan.normalized_email;
        v_outcome := 'matched_existing';
        v_matched := v_matched + 1;
      end if;
    elsif v_plan.proposed_action = 'matched_existing' then
      v_outcome := 'matched_existing';
      v_matched := v_matched + 1;
    else
      v_outcome := v_plan.proposed_action;
      v_skipped := v_skipped + 1;
    end if;

    if v_account_id is not null then
      update public.tenant_orders orders
         set shop_customer_account_id = v_account_id
       where orders.tenant_id = v_plan.legacy_tenant_id
         and orders.shop_id = v_plan.shop_id
         and orders.created_by = v_plan.legacy_user_id
         and orders.shop_customer_account_id is null;
      get diagnostics v_orders_linked = row_count;
      v_total_orders_linked := v_total_orders_linked + v_orders_linked;
    end if;

    insert into private.legacy_shop_customer_migrations (
      legacy_tenant_id, legacy_user_id, shop_id, source_email,
      target_account_id, outcome, orders_linked_count
    ) values (
      v_plan.legacy_tenant_id, v_plan.legacy_user_id, v_plan.shop_id,
      v_plan.normalized_email, v_account_id, v_outcome, v_orders_linked
    )
    on conflict on constraint legacy_shop_customer_migrations_source_unique
    do update set
      source_email = excluded.source_email,
      target_account_id = excluded.target_account_id,
      outcome = excluded.outcome,
      orders_linked_count = private.legacy_shop_customer_migrations.orders_linked_count
        + excluded.orders_linked_count,
      last_attempt_at = clock_timestamp();
  end loop;

  return jsonb_build_object(
    'processed', v_processed,
    'created', v_created,
    'matched_existing', v_matched,
    'skipped', v_skipped,
    'orders_linked', v_total_orders_linked
  );
end;
$$;

revoke all on function private.migrate_legacy_shop_customers(uuid) from public, anon, authenticated;

create or replace function public.api_get_legacy_shop_customer_migration_report(p_tenant_id uuid)
returns table (
  legacy_user_id uuid,
  shop_id uuid,
  normalized_email text,
  proposed_action text,
  target_account_id uuid,
  migration_outcome text,
  orders_linked_count integer,
  last_attempt_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null or not public.user_has_capability(p_tenant_id, 'can_manage_shop_customers') then
    raise exception 'permission_denied: can_manage_shop_customers';
  end if;

  return query
  select
    plan.legacy_user_id,
    plan.shop_id,
    plan.normalized_email,
    plan.proposed_action,
    audit.target_account_id,
    audit.outcome,
    coalesce(audit.orders_linked_count, 0),
    audit.last_attempt_at
  from private.legacy_shop_customer_migration_plan plan
  left join private.legacy_shop_customer_migrations audit
    on audit.legacy_tenant_id = plan.legacy_tenant_id
   and audit.legacy_user_id = plan.legacy_user_id
   and audit.shop_id is not distinct from plan.shop_id
  where plan.legacy_tenant_id = p_tenant_id
  order by plan.normalized_email nulls last, plan.shop_id nulls last;
end;
$$;

revoke all on function public.api_get_legacy_shop_customer_migration_report(uuid) from public, anon;
grant execute on function public.api_get_legacy_shop_customer_migration_report(uuid) to authenticated;

-- Backfill initial. La fonction privée reste disponible pour un import tardif
-- ou une reprise ; elle est idempotente et ne supprime jamais le modèle legacy.
select private.migrate_legacy_shop_customers(null);

notify pgrst, 'reload schema';
