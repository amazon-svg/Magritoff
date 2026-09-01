-- ============================================================================
-- Sprint 5 Gestion commerciale — story E10.2 : Tags libres colores sur les
-- projets, recherche et filtrage.
-- ----------------------------------------------------------------------------
-- Decision RP du 28/08/2026 : le classement par arborescence est ecarte au
-- profit de tags textuels libres, crees a la volee, avec une couleur.
-- Combines a un champ de recherche et un filtre, ils suffisent au reperage
-- des projets.
--
-- Modele :
--   - `project_tags` : un tag est une chaine libre associee a un JETON de
--     couleur d une palette fermee (CA1), jamais un code hexadecimal — la
--     charte doit pouvoir evoluer sans migration. Scope au tenant (CA3) :
--     l unicite porte sur (tenant_id, lower(label)), jamais sur le tenant
--     seul ni le libelle seul, donc deux tenants peuvent partager un
--     libelle sans collision.
--   - `project_tag_links` : table de liaison N-N project <-> tag.
--     `on delete cascade` cote `project_id` (retirer un projet retire ses
--     liens de tags, jamais le contraire). Cote `tag_id`, PAS de cascade :
--     la contrainte par defaut (RESTRICT) refuse la suppression d un tag
--     encore lie a un projet (CA5, code `project_tag.in_use` cote
--     adaptateur) — c est la base qui porte cette regle, pas seulement une
--     verification applicative qui pourrait etre contournee par un acces
--     direct.
--   - Un trigger BEFORE INSERT/UPDATE sur `project_tag_links` verifie que le
--     projet et le tag lies appartiennent au MEME tenant : la RLS seule ne
--     l empeche pas puisqu elle autorise deja l acteur a ecrire sur SES
--     projets et SES tags — rien n empeche par construction de croiser les
--     deux si l application ne le verifiait pas. Defense en profondeur,
--     complementaire au controle applicatif du service (E10.2).
-- ============================================================================

create table if not exists public.project_tags (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  label       text not null check (btrim(label) <> '' and char_length(label) <= 60),
  color       text not null check (color in ('slate', 'blue', 'green', 'amber', 'red', 'violet')),
  created_at  timestamptz not null default now()
);

comment on table public.project_tags is
  'E10.2 — tags libres colores, scopes au tenant (CA1, CA3). Le libelle est affiche tel que saisi ; l unicite porte sur sa forme normalisee (trim, casse insensible).';
comment on column public.project_tags.color is
  'Jeton de couleur d une palette FERMEE (CA1), jamais un code hexadecimal : la charte peut evoluer sans migration.';

-- CA2/CA3 : le controle d unicite porte sur le libelle NORMALISE (trim, casse
-- insensible), pas sur le libelle brut ni le tenant seul. `btrim(lower(...))`
-- plutot que `lower(...)` seul : la normalisation par trim est deja faite par
-- le schema Zod cote application (`createProjectTagCommandSchema`), mais la
-- porter aussi ICI evite qu un acces direct a la table (ou un futur bug
-- applicatif) ne cree deux tags " Urgent" et "Urgent" comme s ils etaient
-- distincts. Deux tenants peuvent partager un libelle sans collision : la
-- cle porte le tenant_id, jamais le libelle seul.
create unique index if not exists project_tags_tenant_label_uidx
  on public.project_tags (tenant_id, btrim(lower(label)));

-- ── Liaison N-N projet <-> tag (CA1, CA5, CA6) ──────────────────────────────
create table if not exists public.project_tag_links (
  project_id  uuid not null references public.projects(id) on delete cascade,
  -- Pas de cascade ici : suppression du tag REFUSEE tant qu il reste lie a
  -- au moins un projet (CA5), portee par la contrainte FK par defaut
  -- (RESTRICT), pas seulement par une verification applicative.
  tag_id      uuid not null references public.project_tags(id),
  created_at  timestamptz not null default now(),
  primary key (project_id, tag_id)
);

comment on table public.project_tag_links is
  'E10.2 — liaison N-N projet <-> tag. Le retrait d un tag d un projet (DELETE de la ligne) ne supprime jamais le tag du tenant (CA5).';

create index if not exists project_tag_links_tag_idx
  on public.project_tag_links (tag_id);

-- ── Defense en profondeur : un lien ne peut joindre projet et tag que du ───
-- meme tenant, meme si un jour un acces direct contournait le service.
create or replace function public.project_tag_links_assert_same_tenant()
returns trigger
language plpgsql
as $$
declare
  v_project_tenant uuid;
  v_tag_tenant uuid;
begin
  select tenant_id into v_project_tenant from public.projects where id = new.project_id;
  select tenant_id into v_tag_tenant from public.project_tags where id = new.tag_id;

  if v_project_tenant is null or v_tag_tenant is null or v_project_tenant <> v_tag_tenant then
    raise exception
      'project_tag_links : le projet (%) et le tag (%) doivent appartenir au meme tenant',
      new.project_id, new.tag_id;
  end if;

  return new;
end;
$$;

drop trigger if exists project_tag_links_same_tenant on public.project_tag_links;
create trigger project_tag_links_same_tenant
  before insert or update on public.project_tag_links
  for each row execute function public.project_tag_links_assert_same_tenant();

-- ── RLS — meme pattern que projects/project_items (20260901000500) ─────────
-- Le grant applicatif de base (select/insert/update/delete a `anon` et
-- `authenticated`) est herite de 20260811000100_api_role_table_grants.sql :
-- la RLS est ici la seule barriere d autorisation.
alter table public.project_tags      enable row level security;
alter table public.project_tag_links enable row level security;

drop policy if exists "project_tags_select" on public.project_tags;
create policy "project_tags_select" on public.project_tags for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

drop policy if exists "project_tags_write" on public.project_tags;
create policy "project_tags_write" on public.project_tags for all using (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = project_tags.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
) with check (
  is_super_admin()
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = project_tags.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
);

drop policy if exists "project_tag_links_select" on public.project_tag_links;
create policy "project_tag_links_select" on public.project_tag_links for select using (
  is_super_admin()
  or exists (
    select 1 from public.projects p
    where p.id = project_tag_links.project_id
      and p.tenant_id in (select public.current_user_tenant_ids())
  )
);

drop policy if exists "project_tag_links_write" on public.project_tag_links;
create policy "project_tag_links_write" on public.project_tag_links for all using (
  is_super_admin()
  or exists (
    select 1 from public.projects p
    join public.tenant_members tm on tm.tenant_id = p.tenant_id
    where p.id = project_tag_links.project_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
) with check (
  is_super_admin()
  or exists (
    select 1 from public.projects p
    join public.tenant_members tm on tm.tenant_id = p.tenant_id
    where p.id = project_tag_links.project_id
      and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  )
);

notify pgrst, 'reload schema';

-- ============================================================================
-- REVERSIBILITE — le CLI Supabase ne gere pas de bloc `down`. SQL de retrait,
-- a jouer tel quel dans une migration inverse si la story est annulee :
--
--   drop trigger if exists project_tag_links_same_tenant on public.project_tag_links;
--   drop function if exists public.project_tag_links_assert_same_tenant();
--   drop policy if exists "project_tag_links_write" on public.project_tag_links;
--   drop policy if exists "project_tag_links_select" on public.project_tag_links;
--   drop policy if exists "project_tags_write" on public.project_tags;
--   drop policy if exists "project_tags_select" on public.project_tags;
--   drop table if exists public.project_tag_links;
--   drop table if exists public.project_tags;
--   notify pgrst, 'reload schema';
--
-- Aucune autre table ne reference `project_tags`/`project_tag_links` : le
-- retrait est sans effet de bord. `projects.tags` (colonne jsonb, E10.1)
-- redevient alors le seul point d extension, deja gere par le code applicatif
-- (toujours '[]' si le repository ne trouve aucun lien).
-- ============================================================================
