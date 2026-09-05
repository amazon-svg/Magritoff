-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.1 : Espace Projets, conteneur de
-- travail en remplacement du panier sur les surfaces internes Magrit.
-- ----------------------------------------------------------------------------
-- Decision RP du 28/08/2026 : la logique « ajouter au panier » est abandonnee
-- sur les surfaces internes Magrit (atelier, resultats de chiffrage). Le
-- projet devient le conteneur de travail et le point d entree de la creation
-- de devis (E10.3, story suivante).
--
-- Modele :
--   - `projects.customer_id` reference `customers` (E10.4, 20260901000300) et
--     est NOT NULL : c est cette contrainte qui porte le CA3 au niveau base,
--     la validation UI n est que du confort. Aucun `on delete cascade` : un
--     client ne se supprime jamais physiquement (E10.4 CA7), donc cette FK ne
--     bloque en pratique que sur une desactivation, jamais une suppression.
--   - `projects.status` ('active'/'archived') porte l archivage (CA6) : jamais
--     un DELETE, la tracabilite commerciale en depend.
--   - `projects.tags` est un point d extension pour E10.2 (tags de projet,
--     story suivante) : colonne presente, jamais alimentee ni exposee en
--     ecriture par cette story — toujours un tableau vide au contrat, meme
--     principe que `customers.projects/quotes/orders` (20260901000300).
--   - `project_items` porte les N elements de chiffrage d un projet (CA4).
--     `quote_payload` conserve le payload de chiffrage tel que calcule (CA5 :
--     reprendre l iteration conversationnelle sans rejouer Clariprint).
--     `clariprint_config` conserve, si disponible, la configuration brute
--     envoyee a Clariprint pour ce chiffrage.
-- ============================================================================

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  customer_id  uuid not null references public.customers(id),
  name         text not null check (btrim(name) <> ''),
  status       text not null default 'active' check (status in ('active', 'archived')),

  -- Point d extension E10.2 (tags de projet) : jamais alimente ni expose en
  -- ecriture par cette story, toujours '[]' au contrat.
  tags         jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),

  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.projects is
  'E10.1 — conteneur de travail commercial (CA1-CA7), remplace le panier sur les surfaces internes Magrit.';
comment on column public.projects.customer_id is
  'NOT NULL : porte le CA3 (creation impossible sans client) au niveau base, pas seulement cote UI/service.';
comment on column public.projects.tags is
  'Point d extension E10.2. Toujours vide tant que cette story n est pas livree (pas de donnee inventee).';

create index if not exists projects_tenant_updated_idx
  on public.projects (tenant_id, updated_at desc);

create index if not exists projects_tenant_customer_idx
  on public.projects (tenant_id, customer_id);

create index if not exists projects_tenant_status_idx
  on public.projects (tenant_id, status);

-- Recherche (`?q=`), insensible a la casse.
create index if not exists projects_tenant_search_idx
  on public.projects (tenant_id, lower(name));

drop trigger if exists projects_set_updated_at on public.projects;
create or replace function public.projects_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.projects_set_updated_at();

-- ── Elements de chiffrage d un projet (CA4, CA5) ────────────────────────────
create table if not exists public.project_items (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  label              text not null check (btrim(label) <> ''),

  -- Payload de chiffrage tel que calcule (CA5) : permet de reprendre l
  -- iteration conversationnelle sans rejouer Clariprint.
  quote_payload      jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(quote_payload) = 'object'),
  -- Configuration Clariprint brute, si disponible pour ce chiffrage.
  clariprint_config  jsonb check (clariprint_config is null or jsonb_typeof(clariprint_config) = 'object'),

  position           integer not null default 0,
  created_at         timestamptz not null default now()
);

comment on table public.project_items is
  'E10.1 CA4/CA5 — elements de chiffrage rattaches a un projet. Le retrait d un element (DELETE /projects/{id}/items/{itemId}) retire le lien, jamais l historique de chiffrage s il existe ailleurs (E10.3+).';

create index if not exists project_items_project_position_idx
  on public.project_items (project_id, position);

-- ── RLS — meme pattern que customers/customer_contacts (20260901000300) ────
-- Le grant applicatif de base (select/insert/update/delete a `anon` et
-- `authenticated`) est herite par defaut de
-- 20260811000100_api_role_table_grants.sql : la RLS est ici la seule barriere
-- d autorisation, pas un `revoke` supplementaire.
alter table public.projects      enable row level security;
alter table public.project_items enable row level security;

drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "projects_write" on public.projects;
create policy "projects_write" on public.projects for all using (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = projects.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
) with check (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = projects.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
);

drop policy if exists "project_items_select" on public.project_items;
create policy "project_items_select" on public.project_items for select using (
  is_super_admin()
  or exists (
    select 1 from public.projects p
    where p.id = project_items.project_id
      and p.tenant_id in (select public.current_user_tenant_ids())
  )
);

drop policy if exists "project_items_write" on public.project_items;
create policy "project_items_write" on public.project_items for all using (
  is_super_admin()
  or exists (
    select 1 from public.projects p
    join public.tenant_members tm on tm.tenant_id = p.tenant_id
    where p.id = project_items.project_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
) with check (
  is_super_admin()
  or exists (
    select 1 from public.projects p
    join public.tenant_members tm on tm.tenant_id = p.tenant_id
    where p.id = project_items.project_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
);

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   drop trigger if exists projects_set_updated_at on public.projects;
--   drop function if exists public.projects_set_updated_at();
--   drop policy if exists "project_items_write" on public.project_items;
--   drop policy if exists "project_items_select" on public.project_items;
--   drop policy if exists "projects_write" on public.projects;
--   drop policy if exists "projects_select" on public.projects;
--   drop table if exists public.project_items;
--   drop table if exists public.projects;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table ne reference `projects`/`project_items` : le retrait est
-- sans effet de bord tant que E10.2/E10.3 ne les referencent pas.
-- ============================================================================
