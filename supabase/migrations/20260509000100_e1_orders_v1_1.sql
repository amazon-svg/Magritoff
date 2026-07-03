-- ─────────────────────────────────────────────────────────────────────────
-- Story S1.4 — Order entity v1.1 (Epic 1, PRD v1.1)
-- ─────────────────────────────────────────────────────────────────────────
-- Cree les 3 tables de l'Order entity persistee :
--   1. tenant_orders                — entete commande (tenant_id, shop_id, status, total_ht)
--   2. tenant_order_items           — lignes (snapshot options Clariprint en JSONB)
--   3. tenant_order_status_events   — audit trail des transitions de statut
--
-- ⚠️ NAMING (decision 2026-05-09) : prefixe `tenant_` pour eviter la collision
-- avec :
--   - public.orders (legacy 20260418_user_data, user_id-based, demo)
--   - public.shop_orders (legacy 20260418_shop_module, shop-owner-based)
-- Cohorte naming homogene avec les autres tables tenant-scoped :
-- tenant_members, tenant_invitations, tenant_member_events, tenant_slug_history,
-- tenant_gamme_subscriptions.
--
-- Schema extensible vers e-invoicing FR PA/PPF (NFR16) sans refactor :
-- colonnes invoice_number, invoice_status, pa_id, ppf_message_id deja presentes
-- (nullable, peuplees seulement quand l'integration PA sera livree V2+).
--
-- RLS strict cote tenant (NFR6) : 0 fuite cross-tenant. Tests vitest associes :
-- tests/rls/orders_isolation.test.ts (>= 6 cas, calque sur tenant_isolation E9.10).
--
-- Pattern audit trail aligne sur tenant_member_events (E9.3) :
-- tout changement de statut passe par le RPC update_tenant_order_status() qui
-- valide la matrice de transitions et insere l'evenement automatiquement.
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Enum statut commande (extensible vers V2+ workflow complet) ───────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'tenant_order_status') then
    create type tenant_order_status as enum (
      'draft',          -- creee, modifiable, annulable par auteur ou admin
      'validated',      -- engagee commercialement (Vision V2+)
      'in_production',  -- (Vision V2+)
      'shipped',        -- (Vision V2+)
      'delivered',      -- (Vision V2+)
      'invoiced',       -- (Vision V2+)
      'cancelled'       -- terminale
    );
  end if;
end $$;

-- ─── 2. Tables ────────────────────────────────────────────────────────────

create table if not exists public.tenant_orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  shop_id         uuid not null references public.shops(id) on delete restrict,
  created_by      uuid not null references auth.users(id),
  status          tenant_order_status not null default 'draft',
  total_ht        numeric(12,2) not null,
  currency        char(3) not null default 'EUR',
  notes           text,
  -- Hooks e-invoicing FR (NFR16) — peuples a partir de V2+
  invoice_number       text,
  invoice_status       text,
  pa_id                text,
  ppf_message_id       text,
  -- Hooks Stripe (E4.3 V2+)
  stripe_payment_intent_id text,
  -- Audit
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  cancelled_at    timestamptz
);

create table if not exists public.tenant_order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.tenant_orders(id) on delete cascade,
  product_id      uuid not null,
  product_label   text not null,
  clariprint_options jsonb not null,  -- snapshot des options au moment de la commande
  quantity        integer not null check (quantity > 0),
  unit_price_ht   numeric(12,2) not null,
  line_total_ht   numeric(12,2) not null,
  -- Hook Canva v1.1 (S5.2 — design lie a la ligne)
  canva_asset_url text,
  created_at      timestamptz not null default now()
);

create table if not exists public.tenant_order_status_events (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.tenant_orders(id) on delete cascade,
  actor_id        uuid not null references auth.users(id),
  from_status     tenant_order_status,
  to_status       tenant_order_status not null,
  reason          text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- ─── 3. Indexes ───────────────────────────────────────────────────────────

create index if not exists idx_tenant_orders_tenant_shop on public.tenant_orders(tenant_id, shop_id);
create index if not exists idx_tenant_orders_created_by on public.tenant_orders(created_by);
create index if not exists idx_tenant_orders_status on public.tenant_orders(status);
create index if not exists idx_tenant_order_items_order on public.tenant_order_items(order_id);
create index if not exists idx_tenant_order_status_events_order on public.tenant_order_status_events(order_id);

-- ─── 4. RLS policies ──────────────────────────────────────────────────────

alter table public.tenant_orders enable row level security;
alter table public.tenant_order_items enable row level security;
alter table public.tenant_order_status_events enable row level security;

-- Drop policies if any leftover from prior partial application (idempotence)
drop policy if exists tenant_orders_select on public.tenant_orders;
drop policy if exists tenant_orders_insert on public.tenant_orders;
drop policy if exists tenant_orders_update on public.tenant_orders;
drop policy if exists tenant_orders_delete on public.tenant_orders;

-- SELECT : un user voit les commandes des shops auxquels il a acces
create policy tenant_orders_select on public.tenant_orders
  for select using (
    public.current_user_can_access_shop(shop_id)
    or public.is_super_admin()
  );

-- INSERT : un user peut creer si access shop ET created_by = self
create policy tenant_orders_insert on public.tenant_orders
  for insert with check (
    public.current_user_can_access_shop(shop_id)
    and created_by = auth.uid()
  );

-- UPDATE : auteur peut update seulement si status='draft' ET created_by=self
-- Admin/owner tenant peut update n'importe quelle commande de son tenant
create policy tenant_orders_update on public.tenant_orders
  for update using (
    (status = 'draft' and created_by = auth.uid())
    or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
    or public.is_super_admin()
  );

-- DELETE : reserve aux admins/owners tenant et superadmin Magrit
create policy tenant_orders_delete on public.tenant_orders
  for delete using (
    public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
    or public.is_super_admin()
  );

-- tenant_order_items : heritent du parent tenant_orders
drop policy if exists tenant_order_items_select on public.tenant_order_items;
drop policy if exists tenant_order_items_insert on public.tenant_order_items;
drop policy if exists tenant_order_items_update on public.tenant_order_items;
drop policy if exists tenant_order_items_delete on public.tenant_order_items;

create policy tenant_order_items_select on public.tenant_order_items
  for select using (
    exists (
      select 1 from public.tenant_orders o
      where o.id = order_id
        and (public.current_user_can_access_shop(o.shop_id) or public.is_super_admin())
    )
  );

create policy tenant_order_items_insert on public.tenant_order_items
  for insert with check (
    exists (
      select 1 from public.tenant_orders o
      where o.id = order_id
        and o.created_by = auth.uid()
        and o.status = 'draft'
    )
    or public.is_super_admin()
  );

create policy tenant_order_items_update on public.tenant_order_items
  for update using (
    exists (
      select 1 from public.tenant_orders o
      where o.id = order_id
        and o.created_by = auth.uid()
        and o.status = 'draft'
    )
    or public.is_super_admin()
  );

create policy tenant_order_items_delete on public.tenant_order_items
  for delete using (
    exists (
      select 1 from public.tenant_orders o
      where o.id = order_id
        and o.created_by = auth.uid()
        and o.status = 'draft'
    )
    or public.is_super_admin()
  );

-- tenant_order_status_events : lecture par tous ceux qui voient la commande,
-- ecriture interdite directement (passe par RPC update_tenant_order_status)
drop policy if exists tenant_order_status_events_select on public.tenant_order_status_events;
drop policy if exists tenant_order_status_events_no_direct_insert on public.tenant_order_status_events;

create policy tenant_order_status_events_select on public.tenant_order_status_events
  for select using (
    exists (
      select 1 from public.tenant_orders o
      where o.id = order_id
        and (public.current_user_can_access_shop(o.shop_id) or public.is_super_admin())
    )
  );

create policy tenant_order_status_events_no_direct_insert on public.tenant_order_status_events
  for insert with check (public.is_super_admin());  -- bloque insert front, RPC contournera via security definer

-- ─── 5. RPC update_tenant_order_status (audit trail garanti + matrice) ────

create or replace function public.update_tenant_order_status(
  p_order_id uuid,
  p_new_status tenant_order_status,
  p_reason text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _order record;
  _caller uuid := auth.uid();
  _is_admin_tenant boolean := false;
  _is_owner boolean := false;
begin
  if _caller is null then
    raise exception 'Authentication required (auth.uid() is null)';
  end if;

  select * into _order from public.tenant_orders where id = p_order_id;
  if _order is null then
    raise exception 'Tenant order % not found', p_order_id;
  end if;

  -- Verifier permissions
  _is_owner := (_order.created_by = _caller);
  select exists(
    select 1 from public.tenant_members tm
    where tm.user_id = _caller and tm.tenant_id = _order.tenant_id and tm.role in ('owner', 'admin')
  ) into _is_admin_tenant;

  -- Matrice de transitions v1.1 (limitee, V2+ etendra) :
  --  - draft -> cancelled : auteur ou admin tenant
  --  - draft -> validated : admin tenant uniquement (workflow V2+)
  --  - autres transitions : refusees en v1.1
  if _order.status = 'draft' and p_new_status = 'cancelled' then
    if not (_is_owner or _is_admin_tenant or public.is_super_admin()) then
      raise exception 'Permission denied: cancel requires owner or admin tenant';
    end if;
  elsif _order.status = 'draft' and p_new_status = 'validated' then
    if not (_is_admin_tenant or public.is_super_admin()) then
      raise exception 'Permission denied: validate requires admin tenant';
    end if;
  else
    raise exception 'Transition % -> % not allowed in v1.1 (workflow complet en V2+)',
      _order.status, p_new_status;
  end if;

  -- Update + audit
  update public.tenant_orders
    set status = p_new_status,
        updated_at = now(),
        cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end
    where id = p_order_id;

  insert into public.tenant_order_status_events (order_id, actor_id, from_status, to_status, reason, metadata)
    values (p_order_id, _caller, _order.status, p_new_status, p_reason, jsonb_build_object(
      'is_owner', _is_owner,
      'is_admin_tenant', _is_admin_tenant
    ));

  return p_order_id;
end;
$$;

grant execute on function public.update_tenant_order_status(uuid, tenant_order_status, text) to authenticated;

-- ─── 6. Trigger updated_at sur tenant_orders ──────────────────────────────

create or replace function public.set_tenant_order_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tenant_orders_updated_at on public.tenant_orders;
create trigger trg_tenant_orders_updated_at
  before update on public.tenant_orders
  for each row execute function public.set_tenant_order_updated_at();
