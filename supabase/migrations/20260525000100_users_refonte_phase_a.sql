-- =============================================================================
-- Migration S-USERS-REFONTE Phase A (Sprint 5 anticipation Sprint 6, 2026-05-25)
--
-- Pose les fondations DB du catalog de rôles configurables par tenant + des
-- assignations users → rôles. Anticipation partielle de S-ORDER-ROLES-1
-- (Sprint 6) pour débloquer le rôle "Acheteur" nommé et les capabilities
-- modulaires (can_validate, can_cancel, can_modify, can_export, etc.).
--
-- Périmètre : couche rôles globaux par tenant uniquement. La couche "rôles
-- par commande" (tenant_order_roles + tenant_order_role_events +
-- tenant_order_status_definitions) reste pour Sprint 6 S-ORDER-ROLES-1.
--
-- Décisions Arnaud (2026-05-25) :
--   - 5 presets standards B2B : Owner, Admin, Acheteur, Validateur, Producteur
--   - Migration data MINIMALE : assigner Owner uniquement à l'utilisateur
--     8e29a136-95df-4ee2-84dd-2ea00a2e1f7c (admin plateforme Magrit) sur
--     tous les tenants où il est membre. Les autres comptes existants
--     restent sur tenant_members.permissions jsonb (back-compat) jusqu'à
--     Phase B (refactor des 15 fichiers qui import useClients).
--   - Cleanup UI section Contacts CRM : géré côté front, pas DB.
--
-- =============================================================================

-- ─── 1. tenant_role_definitions : catalog des rôles par tenant ───────────
create table if not exists public.tenant_role_definitions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  description     text default '',
  /**
   * Capabilities modulaires (jsonb). Liste fermée des clés v1.1 :
   *   can_quote          (créer devis)
   *   can_order          (passer commandes)
   *   can_invite         (inviter d'autres users dans le tenant)
   *   can_validate       (valider une commande draft → validated)
   *   can_cancel         (annuler une commande)
   *   can_modify         (modifier une commande draft)
   *   can_export         (exporter une commande / facture / devis)
   *   can_manage_catalog (gérer catalogue boutique : produits, gammes)
   *   can_manage_roles   (créer/éditer/assigner rôles dans le tenant)
   *
   * Anti-pattern formellement banni : ne PAS ajouter de capabilities ad-hoc
   * via UI utilisateur. La liste est codée en dur côté front + back.
   * Sprint 6 S-ORDER-ROLES-1 ajoutera potentiellement notify_policy et
   * scope_shop_id pour la couche par-commande.
   */
  capabilities    jsonb not null default '{}'::jsonb,
  ordering_index  int not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  archived_at     timestamptz null,
  unique (tenant_id, name)
);
create index if not exists tenant_role_definitions_tenant_idx
  on public.tenant_role_definitions (tenant_id) where archived_at is null;

-- ─── 2. tenant_role_assignments : qui occupe quel rôle dans un tenant ────
-- Indépendant de la commande (couche "par appartenance" cf. Q3 spec
-- S-ORDER-ROLES). 1 row = 1 user a 1 rôle dans 1 tenant à un instant T.
-- Cumul de rôles possible (Q2) : un user peut avoir plusieurs assignments
-- non-révoqués simultanément (ex: Admin + Validateur).
create table if not exists public.tenant_role_assignments (
  id                  uuid primary key default gen_random_uuid(),
  role_definition_id  uuid not null references public.tenant_role_definitions(id) on delete restrict,
  user_id             uuid not null references auth.users(id) on delete cascade,
  assigned_at         timestamptz not null default now(),
  assigned_by         uuid references auth.users(id) on delete set null,
  revoked_at          timestamptz null,
  revoked_by          uuid references auth.users(id) on delete set null
);
-- Unique partiel : un user ne peut pas avoir 2 assignments actifs simultanés
-- du MEME rôle (mais peut avoir 2 historiques si l'un est révoqué).
-- Syntaxe : CREATE UNIQUE INDEX partial (la contrainte UNIQUE inline d'un
-- CREATE TABLE ne supporte PAS la clause WHERE en PG).
create unique index if not exists tenant_role_assignments_active_unique_idx
  on public.tenant_role_assignments (role_definition_id, user_id)
  where revoked_at is null;
create index if not exists tenant_role_assignments_user_active_idx
  on public.tenant_role_assignments (user_id) where revoked_at is null;
create index if not exists tenant_role_assignments_role_idx
  on public.tenant_role_assignments (role_definition_id);

-- ─── 3. Helper SQL : user_has_capability ─────────────────────────────────
-- Check si l'utilisateur courant (auth.uid()) a au moins UN rôle actif
-- (non révoqué + non archivé) sur le tenant donné avec la capability
-- demandée. Réutilisable dans toutes les RLS futures.
create or replace function public.user_has_capability(
  p_tenant_id uuid,
  p_capability text
)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then true
    else exists (
      select 1
      from public.tenant_role_assignments ra
      join public.tenant_role_definitions rd on rd.id = ra.role_definition_id
      where ra.user_id = auth.uid()
        and ra.revoked_at is null
        and rd.tenant_id = p_tenant_id
        and rd.archived_at is null
        and coalesce((rd.capabilities->>p_capability)::boolean, false) = true
    )
  end;
$$;

grant execute on function public.user_has_capability(uuid, text) to authenticated;

-- ─── 4. RLS policies ─────────────────────────────────────────────────────
alter table public.tenant_role_definitions enable row level security;
alter table public.tenant_role_assignments enable row level security;

-- SELECT : un user voit les rôles des tenants auxquels il appartient
drop policy if exists tenant_role_definitions_select on public.tenant_role_definitions;
create policy tenant_role_definitions_select on public.tenant_role_definitions
  for select using (
    public.is_super_admin()
    or tenant_id in (select public.current_user_tenant_ids())
  );

-- INSERT/UPDATE/DELETE : super_admin OU user avec can_manage_roles
drop policy if exists tenant_role_definitions_write on public.tenant_role_definitions;
create policy tenant_role_definitions_write on public.tenant_role_definitions
  for all using (
    public.is_super_admin()
    or public.user_has_capability(tenant_id, 'can_manage_roles')
  ) with check (
    public.is_super_admin()
    or public.user_has_capability(tenant_id, 'can_manage_roles')
  );

-- tenant_role_assignments : visibility = user voit ses assignments + admins
-- tenant voient toutes les assignations du tenant
drop policy if exists tenant_role_assignments_select on public.tenant_role_assignments;
create policy tenant_role_assignments_select on public.tenant_role_assignments
  for select using (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.tenant_role_definitions rd
      where rd.id = role_definition_id
        and rd.tenant_id in (select public.current_user_tenant_ids())
    )
  );

drop policy if exists tenant_role_assignments_write on public.tenant_role_assignments;
create policy tenant_role_assignments_write on public.tenant_role_assignments
  for all using (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_role_definitions rd
      where rd.id = role_definition_id
        and public.user_has_capability(rd.tenant_id, 'can_manage_roles')
    )
  ) with check (
    public.is_super_admin()
    or exists (
      select 1 from public.tenant_role_definitions rd
      where rd.id = role_definition_id
        and public.user_has_capability(rd.tenant_id, 'can_manage_roles')
    )
  );

-- ─── 5. Seed des 5 presets par tenant existant ───────────────────────────
-- Standard B2B (décision Arnaud 2026-05-25) :
--   Owner       : TOUTES les capabilities
--   Admin       : toutes sauf can_manage_roles (réservé Owner par défaut)
--   Acheteur    : can_quote + can_order (scope shop_only en pratique)
--   Validateur  : can_validate + can_cancel + can_modify + can_export
--   Producteur  : can_export + can_modify
--
-- Idempotent via ON CONFLICT (tenant_id, name) DO NOTHING : safe à re-jouer.

insert into public.tenant_role_definitions (tenant_id, name, description, capabilities, ordering_index)
select t.id, 'Owner', 'Propriétaire du tenant — toutes les capabilities',
       '{"can_quote": true, "can_order": true, "can_invite": true, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": true, "can_manage_roles": true}'::jsonb,
       10
from public.tenants t
on conflict (tenant_id, name) do nothing;

insert into public.tenant_role_definitions (tenant_id, name, description, capabilities, ordering_index)
select t.id, 'Admin', 'Administrateur tenant — toutes capabilities sauf gestion des rôles',
       '{"can_quote": true, "can_order": true, "can_invite": true, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": true, "can_manage_roles": false}'::jsonb,
       20
from public.tenants t
on conflict (tenant_id, name) do nothing;

insert into public.tenant_role_definitions (tenant_id, name, description, capabilities, ordering_index)
select t.id, 'Acheteur', 'Passe des devis et commandes sur les boutiques autorisées',
       '{"can_quote": true, "can_order": true, "can_invite": false, "can_validate": false, "can_cancel": false, "can_modify": false, "can_export": false, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
       30
from public.tenants t
on conflict (tenant_id, name) do nothing;

insert into public.tenant_role_definitions (tenant_id, name, description, capabilities, ordering_index)
select t.id, 'Validateur', 'Valide les commandes draft → validated + actions intermédiaires',
       '{"can_quote": false, "can_order": false, "can_invite": false, "can_validate": true, "can_cancel": true, "can_modify": true, "can_export": true, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
       40
from public.tenants t
on conflict (tenant_id, name) do nothing;

insert into public.tenant_role_definitions (tenant_id, name, description, capabilities, ordering_index)
select t.id, 'Producteur', 'Met à jour le statut de production + exporte les commandes',
       '{"can_quote": false, "can_order": false, "can_invite": false, "can_validate": false, "can_cancel": false, "can_modify": true, "can_export": true, "can_manage_catalog": false, "can_manage_roles": false}'::jsonb,
       50
from public.tenants t
on conflict (tenant_id, name) do nothing;

-- ─── 6. Migration data MINIMALE : assigner Owner à Arnaud sur ses tenants ────
-- user_id = 8e29a136-95df-4ee2-84dd-2ea00a2e1f7c (admin plateforme).
-- Décision 2026-05-25 : ne PAS migrer les autres comptes (créera des comptes
-- clean via la nouvelle UI). Idempotent via WHERE NOT EXISTS sur l'index
-- partiel unique (revoked_at is null).
insert into public.tenant_role_assignments (role_definition_id, user_id, assigned_by)
select rd.id,
       '8e29a136-95df-4ee2-84dd-2ea00a2e1f7c'::uuid,
       '8e29a136-95df-4ee2-84dd-2ea00a2e1f7c'::uuid
from public.tenant_role_definitions rd
join public.tenant_members tm on tm.tenant_id = rd.tenant_id
where rd.name = 'Owner'
  and tm.user_id = '8e29a136-95df-4ee2-84dd-2ea00a2e1f7c'
  and rd.archived_at is null
  and not exists (
    select 1 from public.tenant_role_assignments existing
    where existing.role_definition_id = rd.id
      and existing.user_id = '8e29a136-95df-4ee2-84dd-2ea00a2e1f7c'::uuid
      and existing.revoked_at is null
  );

-- Reload schema cache PostgREST
notify pgrst, 'reload schema';
