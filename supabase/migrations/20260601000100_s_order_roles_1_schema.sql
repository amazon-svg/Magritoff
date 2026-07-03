-- =============================================================================
-- Migration S-ORDER-ROLES-1 (Sprint 6, 2026-06-01)
--
-- Pose les fondations DB de la couche "rôles par commande" — assignment d'un
-- user sur un rôle SPÉCIFIQUE à une commande (vs Phase A qui modélise les
-- rôles globaux par tenant).
--
-- Couche complète après livraison :
--   tenant_role_definitions      [Phase A] catalog des rôles par tenant
--   tenant_role_assignments      [Phase A] qui occupe quel rôle (global tenant)
--   tenant_order_roles           [ICI]     qui occupe quel rôle SUR UNE COMMANDE
--   tenant_order_role_events     [ICI]     audit trail des transitions de rôles
--   tenant_order_status_definitions [ICI]  enum statuts extensibles par tenant
--
-- + ALTER tenant_role_definitions pour ajouter notify_policy, scope,
--   scope_shop_id (overview Q1/Q3) que Phase A n'avait pas posés.
--
-- ADR §4.12 formalisée dans architecture.md : "Couche rôles workflow séparée
-- de tenant_members.permissions" (décision Q4 Arnaud 2026-05-21).
--
-- Décisions Q1-Q10 tranchées 2026-05-22 (voir story-S-ORDER-ROLES overview).
-- Audit prod 2026-06-01 : 11 commandes, statuts utilisés {draft, cancelled,
-- validated}. Pas d'inconnu en DB. Seed canonique des 7 codes enum existant.
-- =============================================================================

-- ─── 1. ALTER tenant_role_definitions : ajout notify_policy + scope ──────
-- Phase A avait posé la table sans ces 3 colonnes. On les ajoute ici car
-- elles font partie du modèle complet (overview Q1 + Q3 + Q9).

alter table public.tenant_role_definitions
  add column if not exists notify_policy text not null default 'chain_next';

alter table public.tenant_role_definitions
  add column if not exists scope text not null default 'tenant';

alter table public.tenant_role_definitions
  add column if not exists scope_shop_id uuid null references public.shops(id) on delete cascade;

-- Contraintes CHECK (idempotentes via DO bloc + EXCEPTION duplicate_object)
do $$
begin
  alter table public.tenant_role_definitions
    add constraint tenant_role_definitions_notify_policy_check
    check (notify_policy in ('chain_next', 'all_roles', 'none'));
exception when duplicate_object then null; end $$;

do $$
begin
  alter table public.tenant_role_definitions
    add constraint tenant_role_definitions_scope_check
    check (scope in ('tenant', 'shop'));
exception when duplicate_object then null; end $$;

-- Cohérence : si scope='tenant' alors scope_shop_id doit être null ;
-- si scope='shop' alors scope_shop_id doit être non null.
do $$
begin
  alter table public.tenant_role_definitions
    add constraint tenant_role_definitions_scope_shop_id_consistency
    check (
      (scope = 'tenant' and scope_shop_id is null)
      or (scope = 'shop' and scope_shop_id is not null)
    );
exception when duplicate_object then null; end $$;

-- ─── 2. tenant_order_status_definitions : enum statuts extensible par tenant ──
-- Q7 Arnaud : système extensible. Implémentation MVP v1.1 : la colonne
-- tenant_orders.status reste enum SQL strict (no breaking change), cette
-- table est le MIROIR éditable + labels custom UI. La migration enum->text
-- pour permettre de vrais statuts custom est tracée pour Sprint 8+ audit
-- dette. En MVP, l'admin peut désactiver/réordonner/relabéliser mais pas
-- créer un code custom.

create table if not exists public.tenant_order_status_definitions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  /**
   * Code statut. En MVP v1.1, doit correspondre à une valeur de l'enum
   * public.tenant_order_status (draft / validated / in_production / shipped /
   * delivered / invoiced / cancelled). Sprint 8+ : migration enum->text pour
   * permettre des statuts custom.
   */
  code            text not null,
  /** Label FR affiché à l'utilisateur (editable par admin tenant). */
  label           text not null,
  /** Couleur hex pour pastille statut UI (tailwind palette friendly). */
  color           text not null default '#6b7280',
  ordering_index  int not null default 0,
  is_terminal     boolean not null default false,
  archived_at     timestamptz null,
  created_at      timestamptz not null default now(),
  unique (tenant_id, code)
);
create index if not exists tenant_order_status_definitions_tenant_idx
  on public.tenant_order_status_definitions (tenant_id) where archived_at is null;

-- ─── 3. tenant_order_roles : qui occupe quel rôle SUR UNE COMMANDE ───────
-- Q6 décision : table dédiée (vs JSONB). 1 row par couple user × commande × rôle.
-- Cumul autorisé (Q2) : un user peut avoir N rôles différents sur la même
-- commande mais pas 2 fois le MEME rôle (UNIQUE constraint).
-- Soft-delete via revoked_at pour conserver historique (couplé audit Q8).

create table if not exists public.tenant_order_roles (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.tenant_orders(id) on delete cascade,
  role_definition_id  uuid not null references public.tenant_role_definitions(id) on delete restrict,
  user_id             uuid not null references auth.users(id) on delete cascade,
  assigned_at         timestamptz not null default now(),
  assigned_by         uuid null references auth.users(id) on delete set null,
  revoked_at          timestamptz null,
  revoked_by          uuid null references auth.users(id) on delete set null,
  unique (order_id, role_definition_id, user_id)
);
-- Index partiel actifs : "toutes les commandes que je dois valider"
create index if not exists tenant_order_roles_user_active_idx
  on public.tenant_order_roles (user_id) where revoked_at is null;
create index if not exists tenant_order_roles_order_idx
  on public.tenant_order_roles (order_id);

-- ─── 4. tenant_order_role_events : audit trail transitions rôles ──────────
-- Q8 décision : table dédiée pour audit (vs trigger sur tenant_order_roles
-- avec ligne miroir). Permet event_type 'capability_updated' qui n'a pas
-- de changement de row sur tenant_order_roles.
-- Coexiste avec tenant_order_status_events existante (livrée S1.4).
-- Lecture UI : S3.5 fera UNION des 2 tables ordonnée par occurred_at.

create table if not exists public.tenant_order_role_events (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.tenant_orders(id) on delete cascade,
  role_definition_id  uuid null references public.tenant_role_definitions(id) on delete set null,
  user_id             uuid null references auth.users(id) on delete set null,
  event_type          text not null check (event_type in ('assigned', 'revoked', 'capability_updated')),
  actor_user_id       uuid null references auth.users(id) on delete set null,
  payload             jsonb not null default '{}'::jsonb,
  occurred_at         timestamptz not null default now()
);
create index if not exists tenant_order_role_events_order_idx
  on public.tenant_order_role_events (order_id);
create index if not exists tenant_order_role_events_occurred_at_idx
  on public.tenant_order_role_events (occurred_at desc);

-- ─── 5. Helpers SQL : user_has_order_role + user_can_validate_order ──────
-- AC4 spec. Marqués SECURITY INVOKER pour respecter la RLS appelante
-- (vs Phase A user_has_capability qui était SECURITY DEFINER pour usage
-- dans les policies RLS de tenant_role_assignments). Ici les helpers
-- servent d'abord côté UI/RPC, pas comme policy guard direct.

create or replace function public.user_has_order_role(
  p_order_id uuid,
  p_capability text
)
returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (
    select 1
    from public.tenant_order_roles tor
    join public.tenant_role_definitions trd on trd.id = tor.role_definition_id
    where tor.order_id = p_order_id
      and tor.user_id = auth.uid()
      and tor.revoked_at is null
      and trd.archived_at is null
      and coalesce((trd.capabilities->>p_capability)::boolean, false) = true
  );
$$;

grant execute on function public.user_has_order_role(uuid, text) to authenticated;

create or replace function public.user_can_validate_order(p_order_id uuid)
returns boolean
language sql stable security invoker set search_path = public as $$
  select public.user_has_order_role(p_order_id, 'can_validate');
$$;

grant execute on function public.user_can_validate_order(uuid) to authenticated;

-- ─── 6. RLS sur les 3 nouvelles tables ────────────────────────────────────
alter table public.tenant_order_status_definitions enable row level security;
alter table public.tenant_order_roles enable row level security;
alter table public.tenant_order_role_events enable row level security;

-- ─ tenant_order_status_definitions ─────────────────────────────────────
-- SELECT : tous les membres du tenant peuvent lire (catalog visible).
drop policy if exists tenant_order_status_definitions_select on public.tenant_order_status_definitions;
create policy tenant_order_status_definitions_select on public.tenant_order_status_definitions
  for select using (
    public.is_super_admin()
    or tenant_id in (select public.current_user_tenant_ids())
  );
-- INSERT/UPDATE/DELETE : super_admin OU user avec can_manage_roles.
drop policy if exists tenant_order_status_definitions_write on public.tenant_order_status_definitions;
create policy tenant_order_status_definitions_write on public.tenant_order_status_definitions
  for all using (
    public.is_super_admin()
    or public.user_has_capability(tenant_id, 'can_manage_roles')
  ) with check (
    public.is_super_admin()
    or public.user_has_capability(tenant_id, 'can_manage_roles')
  );

-- ─ tenant_order_roles ──────────────────────────────────────────────────
-- SELECT : (a) le user lui-même voit ses propres assignments,
--         (b) les membres du tenant qui possède la commande voient tous
--             les assignments (admin tenant peut superviser).
drop policy if exists tenant_order_roles_select on public.tenant_order_roles;
create policy tenant_order_roles_select on public.tenant_order_roles
  for select using (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.tenant_orders o
      where o.id = order_id
        and o.tenant_id in (select public.current_user_tenant_ids())
    )
  );

-- INSERT/UPDATE/DELETE : super_admin uniquement en direct. Les RPC
-- S-ORDER-ROLES-2 (assign_tenant_order_role / revoke / update_capabilities)
-- seront SECURITY DEFINER pour passer outre cette policy.
-- Justification : on veut que TOUTE écriture passe par RPC pour garantir
-- l'audit dans tenant_order_role_events (trigger ou écriture explicite RPC).
drop policy if exists tenant_order_roles_write_admin on public.tenant_order_roles;
create policy tenant_order_roles_write_admin on public.tenant_order_roles
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─ tenant_order_role_events ────────────────────────────────────────────
-- SELECT : membres du tenant qui possède la commande.
drop policy if exists tenant_order_role_events_select on public.tenant_order_role_events;
create policy tenant_order_role_events_select on public.tenant_order_role_events
  for select using (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_orders o
      where o.id = order_id
        and o.tenant_id in (select public.current_user_tenant_ids())
    )
  );

-- INSERT bloqué pour tous sauf super_admin. Les RPC S-ORDER-ROLES-2
-- (SECURITY DEFINER) écrivent dans cette table après chaque transition.
drop policy if exists tenant_order_role_events_write_admin on public.tenant_order_role_events;
create policy tenant_order_role_events_write_admin on public.tenant_order_role_events
  for all using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── 7. Seed des statuts canoniques par tenant existant ──────────────────
-- 7 codes correspondants à l'enum public.tenant_order_status. Labels FR
-- standards Magrit. Idempotent via ON CONFLICT (tenant_id, code) DO NOTHING.
-- Audit prod 2026-06-01 : 11 commandes, statuts en usage {draft, validated,
-- cancelled}. Pas d'inconnu, seed safe.

insert into public.tenant_order_status_definitions (tenant_id, code, label, color, ordering_index, is_terminal)
select t.id, 'draft', 'Brouillon', '#9ca3af', 10, false from public.tenants t
on conflict (tenant_id, code) do nothing;

insert into public.tenant_order_status_definitions (tenant_id, code, label, color, ordering_index, is_terminal)
select t.id, 'validated', 'Validée', '#10b981', 20, false from public.tenants t
on conflict (tenant_id, code) do nothing;

insert into public.tenant_order_status_definitions (tenant_id, code, label, color, ordering_index, is_terminal)
select t.id, 'in_production', 'En production', '#3b82f6', 30, false from public.tenants t
on conflict (tenant_id, code) do nothing;

insert into public.tenant_order_status_definitions (tenant_id, code, label, color, ordering_index, is_terminal)
select t.id, 'shipped', 'Expédiée', '#8b5cf6', 40, false from public.tenants t
on conflict (tenant_id, code) do nothing;

insert into public.tenant_order_status_definitions (tenant_id, code, label, color, ordering_index, is_terminal)
select t.id, 'delivered', 'Livrée', '#059669', 50, true from public.tenants t
on conflict (tenant_id, code) do nothing;

insert into public.tenant_order_status_definitions (tenant_id, code, label, color, ordering_index, is_terminal)
select t.id, 'invoiced', 'Facturée', '#0891b2', 60, true from public.tenants t
on conflict (tenant_id, code) do nothing;

insert into public.tenant_order_status_definitions (tenant_id, code, label, color, ordering_index, is_terminal)
select t.id, 'cancelled', 'Annulée', '#ef4444', 70, true from public.tenants t
on conflict (tenant_id, code) do nothing;

-- ─── 8. Reload schema cache PostgREST ───────────────────────────────────
notify pgrst, 'reload schema';
