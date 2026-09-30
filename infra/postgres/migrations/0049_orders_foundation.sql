create type public.tenant_order_status as enum (
  'draft', 'validated', 'in_production', 'shipped', 'delivered', 'invoiced', 'cancelled'
);

create table public.tenant_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete restrict,
  created_by uuid references public.app_users(id) on delete set null,
  shop_customer_account_id uuid,
  acted_by_magrit_user_id uuid references public.app_users(id) on delete set null,
  status public.tenant_order_status not null default 'draft',
  total_ht numeric(12,2) not null check (total_ht >= 0),
  currency char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  notes text not null default '' check (char_length(notes) <= 5000),
  has_unverified_prices boolean not null default false,
  invoice_number text,
  invoice_status text,
  pa_id text,
  ppf_message_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  cancelled_at timestamptz,
  foreign key (shop_id,tenant_id) references public.shops(id,tenant_id) on delete restrict,
  foreign key (shop_customer_account_id,shop_id)
    references public.shop_customer_accounts(id,shop_id) on delete restrict,
  constraint tenant_orders_creator_identity_check check (
    created_by is not null or shop_customer_account_id is not null
  ),
  constraint tenant_orders_delegated_actor_check check (
    acted_by_magrit_user_id is null or shop_customer_account_id is not null
  )
);
create index tenant_orders_tenant_created_idx on public.tenant_orders(tenant_id,created_at desc,id);
create index tenant_orders_shop_status_idx on public.tenant_orders(shop_id,status,created_at desc);
create index tenant_orders_creator_idx on public.tenant_orders(created_by,created_at desc)
  where created_by is not null;
create index tenant_orders_shop_customer_idx
  on public.tenant_orders(shop_customer_account_id,created_at desc)
  where shop_customer_account_id is not null;

create table public.tenant_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.tenant_orders(id) on delete cascade,
  product_id uuid references public.product_library(id) on delete restrict,
  product_label text not null check (btrim(product_label) <> '' and char_length(product_label) <= 300),
  clariprint_options jsonb not null default '{}'::jsonb
    check (jsonb_typeof(clariprint_options) = 'object'),
  quantity integer not null check (quantity > 0),
  unit_price_ht numeric(12,2) not null check (unit_price_ht >= 0),
  line_total_ht numeric(12,2) not null check (line_total_ht >= 0),
  price_origin text not null check (
    price_origin in ('catalog','quoted','client_unverified','legacy')
  ),
  canva_asset_url text,
  created_at timestamptz not null default clock_timestamp()
);
create index tenant_order_items_order_idx on public.tenant_order_items(order_id,created_at,id);

create table public.tenant_order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.tenant_orders(id) on delete cascade,
  actor_id uuid references public.app_users(id) on delete set null,
  shop_customer_account_id uuid references public.shop_customer_accounts(id) on delete set null,
  acted_by_magrit_user_id uuid references public.app_users(id) on delete set null,
  from_status public.tenant_order_status,
  to_status public.tenant_order_status not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default clock_timestamp(),
  constraint tenant_order_status_events_identity_check check (
    actor_id is not null or shop_customer_account_id is not null
  )
);
create index tenant_order_status_events_order_idx
  on public.tenant_order_status_events(order_id,created_at,id);

create table public.tenant_order_status_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check (code in (
    'draft','validated','in_production','shipped','delivered','invoiced','cancelled'
  )),
  label text not null check (btrim(label)<>''),
  color text not null default '#6b7280' check (color ~ '^#[0-9a-fA-F]{6}$'),
  ordering_index integer not null default 0,
  is_terminal boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(tenant_id,code)
);
create index tenant_order_status_definitions_active_idx
  on public.tenant_order_status_definitions(tenant_id,ordering_index,id)
  where archived_at is null;

create table public.tenant_order_status_transitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  from_status_code text not null,
  to_status_code text not null,
  required_capability text,
  self_service_creator boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  unique(tenant_id,from_status_code,to_status_code),
  foreign key (tenant_id,from_status_code)
    references public.tenant_order_status_definitions(tenant_id,code) on delete cascade,
  foreign key (tenant_id,to_status_code)
    references public.tenant_order_status_definitions(tenant_id,code) on delete cascade
);

create table public.tenant_order_roles (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.tenant_orders(id) on delete cascade,
  role_definition_id uuid not null references public.tenant_role_definitions(id) on delete restrict,
  user_id uuid not null references public.app_users(id) on delete cascade,
  assigned_at timestamptz not null default clock_timestamp(),
  assigned_by uuid references public.app_users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete set null
);
create unique index tenant_order_roles_active_uidx
  on public.tenant_order_roles(order_id,role_definition_id,user_id) where revoked_at is null;
create index tenant_order_roles_user_active_idx
  on public.tenant_order_roles(user_id,order_id) where revoked_at is null;

create table public.tenant_order_role_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.tenant_orders(id) on delete cascade,
  role_definition_id uuid references public.tenant_role_definitions(id) on delete set null,
  user_id uuid references public.app_users(id) on delete set null,
  event_type text not null check (event_type in ('assigned','revoked','capability_updated')),
  actor_user_id uuid references public.app_users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  occurred_at timestamptz not null default clock_timestamp()
);
create index tenant_order_role_events_order_idx
  on public.tenant_order_role_events(order_id,occurred_at,id);

create table public.order_command_receipts (
  id uuid primary key default gen_random_uuid(),
  actor_kind text not null check (actor_kind in ('magrit_user','storefront_customer')),
  actor_id uuid not null,
  command_type text not null check (command_type in ('order.create','order.update','order.transition')),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 200),
  aggregate_id uuid not null references public.tenant_orders(id) on delete cascade,
  result jsonb not null check (jsonb_typeof(result)='object'),
  created_at timestamptz not null default clock_timestamp(),
  unique(actor_kind,actor_id,command_type,idempotency_key)
);
create index order_command_receipts_created_idx on public.order_command_receipts(created_at);

create function magrit.touch_tenant_order_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at=clock_timestamp();
  return new;
end $$;
create trigger tenant_orders_touch_updated_at before update on public.tenant_orders
for each row execute function magrit.touch_tenant_order_updated_at();

create function magrit.tenant_order_items_require_draft()
returns trigger language plpgsql as $$
declare current_status public.tenant_order_status;
begin
  select status into current_status from public.tenant_orders
   where id=coalesce(old.order_id,new.order_id);
  if current_status is null and tg_op='DELETE' then return old; end if;
  if current_status is distinct from 'draft'::public.tenant_order_status then
    raise exception using errcode='23514',message='order_item_immutable_after_draft';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger tenant_order_items_require_draft
before insert or update or delete on public.tenant_order_items
for each row execute function magrit.tenant_order_items_require_draft();

create function magrit.seed_tenant_order_workflow(requested_tenant_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
begin
  insert into public.tenant_order_status_definitions
    (tenant_id,code,label,color,ordering_index,is_terminal)
  values
    (requested_tenant_id,'draft','Brouillon','#9ca3af',10,false),
    (requested_tenant_id,'validated','Validée','#10b981',20,false),
    (requested_tenant_id,'in_production','En production','#3b82f6',30,false),
    (requested_tenant_id,'shipped','Expédiée','#8b5cf6',40,false),
    (requested_tenant_id,'delivered','Livrée','#059669',50,true),
    (requested_tenant_id,'invoiced','Facturée','#0891b2',60,true),
    (requested_tenant_id,'cancelled','Annulée','#ef4444',70,true)
  on conflict(tenant_id,code) do nothing;

  insert into public.tenant_order_status_transitions
    (tenant_id,from_status_code,to_status_code,required_capability,self_service_creator)
  values
    (requested_tenant_id,'draft','validated','can_validate',false),
    (requested_tenant_id,'draft','cancelled','can_cancel',true),
    (requested_tenant_id,'validated','in_production','can_modify',false),
    (requested_tenant_id,'validated','cancelled','can_cancel',false),
    (requested_tenant_id,'in_production','shipped','can_modify',false),
    (requested_tenant_id,'shipped','delivered','can_modify',false),
    (requested_tenant_id,'delivered','invoiced','can_modify',false)
  on conflict(tenant_id,from_status_code,to_status_code) do nothing;
end $$;

select magrit.seed_tenant_order_workflow(id) from public.tenants;

create function magrit.seed_tenant_order_workflow_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,magrit as $$
begin
  perform magrit.seed_tenant_order_workflow(new.id);
  return new;
end $$;
create trigger tenants_seed_order_workflow after insert on public.tenants
for each row execute function magrit.seed_tenant_order_workflow_trigger();

alter table public.tenant_orders enable row level security;
alter table public.tenant_orders force row level security;
alter table public.tenant_order_items enable row level security;
alter table public.tenant_order_items force row level security;
alter table public.tenant_order_status_events enable row level security;
alter table public.tenant_order_status_events force row level security;
alter table public.tenant_order_status_definitions enable row level security;
alter table public.tenant_order_status_definitions force row level security;
alter table public.tenant_order_status_transitions enable row level security;
alter table public.tenant_order_status_transitions force row level security;
alter table public.tenant_order_roles enable row level security;
alter table public.tenant_order_roles force row level security;
alter table public.tenant_order_role_events enable row level security;
alter table public.tenant_order_role_events force row level security;
alter table public.order_command_receipts enable row level security;
alter table public.order_command_receipts force row level security;

create policy tenant_orders_member_access on public.tenant_orders for all using (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
) with check (
  tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
);
create policy tenant_order_items_member_access on public.tenant_order_items for all using (
  exists(select 1 from public.tenant_orders orders where orders.id=order_id)
) with check (
  exists(select 1 from public.tenant_orders orders where orders.id=order_id)
);
create policy tenant_order_status_events_member_access on public.tenant_order_status_events for all using (
  exists(select 1 from public.tenant_orders orders where orders.id=order_id)
) with check (
  exists(select 1 from public.tenant_orders orders where orders.id=order_id)
);
create policy tenant_order_status_definitions_member_access
  on public.tenant_order_status_definitions for all using (
    tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
  ) with check (
    tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_roles')
  );
create policy tenant_order_status_transitions_member_access
  on public.tenant_order_status_transitions for all using (
    tenant_id=magrit.current_tenant_id() and magrit.current_user_can_access_tenant(tenant_id)
  ) with check (
    tenant_id=magrit.current_tenant_id() and magrit.actor_has_capability(tenant_id,'can_manage_roles')
  );
create policy tenant_order_roles_member_access on public.tenant_order_roles for all using (
  exists(select 1 from public.tenant_orders orders where orders.id=order_id)
) with check (
  exists(select 1 from public.tenant_orders orders where orders.id=order_id)
);
create policy tenant_order_role_events_member_access on public.tenant_order_role_events for all using (
  exists(select 1 from public.tenant_orders orders where orders.id=order_id)
) with check (
  exists(select 1 from public.tenant_orders orders where orders.id=order_id)
);
create policy order_command_receipts_server_only on public.order_command_receipts
  for all to magrit_api using (true) with check (true);

revoke all on table public.tenant_orders,public.tenant_order_items,
  public.tenant_order_status_events,public.tenant_order_status_definitions,
  public.tenant_order_status_transitions,public.tenant_order_roles,
  public.tenant_order_role_events,public.order_command_receipts from public;
grant select,insert,update,delete on table public.tenant_orders,public.tenant_order_items,
  public.tenant_order_status_events,public.tenant_order_status_definitions,
  public.tenant_order_status_transitions,public.tenant_order_roles,
  public.tenant_order_role_events,public.order_command_receipts to magrit_api;

comment on table public.tenant_orders is
  'Commandes boutique portables, rattachees a un utilisateur Magrit ou a un compte storefront.';
comment on table public.order_command_receipts is
  'Resultats durables des commandes idempotentes create/update/transition.';
