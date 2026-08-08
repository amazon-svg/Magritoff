-- ============================================================================
-- REFONTE-UX 2026-08-08 — Module Gestion commerciale (point 7, demande Arnaud)
-- ----------------------------------------------------------------------------
-- Regles de prix commerciales par gamme/produit x client/groupe de clients.
-- Frontiere RP#070826 (BK-RP070826-24) : les COUTS de production vivent dans
-- Clariprint Data ; les PRIX DE VENTE, marges et remises vivent ici (GesCom).
--
-- Application : les regles s appliquent au-dessus du prix resolu par
-- resolvePrice() (hierarchie clariprint > library_cached > prix_marche) pour
-- un contexte client donne — devis fait pour ce client, ou boutique qui lui
-- est dediee. Resolution cote front : applyCommercialRules() dans
-- src/app/components/dashboard/commercial/commercial.helpers.ts
-- ============================================================================

-- ── Groupes de clients ──────────────────────────────────────────────────────
create table if not exists public.client_groups (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.client_group_members (
  group_id    uuid not null references public.client_groups(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ── Regles de prix ──────────────────────────────────────────────────────────
-- scope_type  : a qui la regle s applique
--   'tenant' = tous les clients de l espace (regle par defaut)
--   'group'  = un groupe de clients (group_id renseigne)
--   'user'   = un client precis (user_id renseigne)
-- target_type : sur quoi elle porte
--   'all'     = tout le catalogue
--   'gamme'   = une gamme (gamme_slug renseigne)
--   'product' = une definition produit (product_definition_id renseigne)
-- adjust_mode : comment elle ajuste le prix de base
--   'margin_pct'   = marge ajoutee (+X %)
--   'discount_pct' = remise accordee (-X %)
--   'fixed_price'  = prix impose (montant unitaire)
create table if not exists public.client_price_rules (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  name                   text not null,
  scope_type             text not null check (scope_type in ('tenant','group','user')),
  group_id               uuid references public.client_groups(id) on delete cascade,
  user_id                uuid references auth.users(id) on delete cascade,
  target_type            text not null check (target_type in ('all','gamme','product')),
  gamme_slug             text,
  product_definition_id  uuid references public.product_definitions(id) on delete cascade,
  adjust_mode            text not null check (adjust_mode in ('margin_pct','discount_pct','fixed_price')),
  value                  numeric(12,4) not null,
  priority               integer not null default 100,
  active                 boolean not null default true,
  valid_from             date,
  valid_until            date,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Coherence scope <-> colonnes
  constraint cpr_scope_group check (scope_type <> 'group' or group_id is not null),
  constraint cpr_scope_user  check (scope_type <> 'user'  or user_id  is not null),
  constraint cpr_target_gamme   check (target_type <> 'gamme'   or gamme_slug is not null),
  constraint cpr_target_product check (target_type <> 'product' or product_definition_id is not null)
);

create index if not exists cpr_tenant_idx on public.client_price_rules (tenant_id, active);
create index if not exists cgm_user_idx   on public.client_group_members (user_id);

-- ── RLS — meme pattern que le reste du schema tenant-scoped ─────────────────
alter table public.client_groups        enable row level security;
alter table public.client_group_members enable row level security;
alter table public.client_price_rules   enable row level security;

-- Lecture : tout membre du tenant (les regles servent au calcul de prix
-- affiche au client dans sa boutique / ses devis).
drop policy if exists "client_groups_select" on public.client_groups;
create policy "client_groups_select" on public.client_groups for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

-- Ecriture : owner/admin du tenant.
drop policy if exists "client_groups_write" on public.client_groups;
create policy "client_groups_write" on public.client_groups for all using (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = client_groups.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner','admin')
  )
);

drop policy if exists "client_group_members_select" on public.client_group_members;
create policy "client_group_members_select" on public.client_group_members for select using (
  is_super_admin()
  or exists (
    select 1 from public.client_groups cg
    where cg.id = client_group_members.group_id
      and cg.tenant_id in (select public.current_user_tenant_ids())
  )
);

drop policy if exists "client_group_members_write" on public.client_group_members;
create policy "client_group_members_write" on public.client_group_members for all using (
  is_super_admin()
  or exists (
    select 1 from public.client_groups cg
    join public.tenant_members tm on tm.tenant_id = cg.tenant_id
    where cg.id = client_group_members.group_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner','admin')
  )
);

drop policy if exists "client_price_rules_select" on public.client_price_rules;
create policy "client_price_rules_select" on public.client_price_rules for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "client_price_rules_write" on public.client_price_rules;
create policy "client_price_rules_write" on public.client_price_rules for all using (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = client_price_rules.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner','admin')
  )
);
