-- =============================================================================
-- Migration 01 / v3 — Tenants core
-- -----------------------------------------------------------------------------
-- Cree le socle multi-tenant :
--   * tenants                — un tenant = un espace isole (imprimerie OU sous-espace)
--   * tenant_members         — qui a acces a quoi, avec quel role
--   * tenant_invitations     — invitations pendantes (magic link email)
--
-- Hierarchie 2 niveaux via parent_tenant_id :
--   tenant racine "imprimerie-dupont"
--     └─ sous-tenant "dupont-carrefour-france"   (partner = client B2B externe)
--     └─ sous-tenant "dupont-bordeaux"           (member = filiale interne)
--
-- Le tenant "magrit-root" est un tenant special (is_system_tenant = true) dans
-- lequel est membre l'equipe Magrit. Ses membres ont un acces superadmin qui
-- permet de voir tous les tenants (pour support, facturation, admin PIM).
--
-- NB : toute creation d'un tenant avec parent_tenant_id non null est interdite
-- si le parent a lui-meme un parent (on garde max 2 niveaux). Enforce via
-- trigger plus bas.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ─── Table tenants ─────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,       -- 'imprimerie-dupont' (URL-safe)
  name               text not null,              -- 'Imprimerie Dupont'
  parent_tenant_id   uuid references public.tenants(id) on delete cascade,
  plan               text not null default 'freemium',  -- freemium | pro | enterprise
  is_system_tenant   boolean not null default false,    -- true pour magrit-root
  settings           jsonb not null default '{}'::jsonb, -- branding, features, limits
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists tenants_slug_idx on public.tenants(slug);
create index if not exists tenants_parent_idx on public.tenants(parent_tenant_id);

-- Contrainte applicative : max 2 niveaux de hierarchie.
create or replace function public.enforce_tenant_depth()
returns trigger language plpgsql as $$
declare grandparent uuid;
begin
  if new.parent_tenant_id is not null then
    select parent_tenant_id into grandparent
    from public.tenants where id = new.parent_tenant_id;
    if grandparent is not null then
      raise exception 'Tenants can only be 2 levels deep (root -> child). Found: %', new.parent_tenant_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_tenant_depth on public.tenants;
create trigger trg_enforce_tenant_depth
  before insert or update of parent_tenant_id on public.tenants
  for each row execute function public.enforce_tenant_depth();

-- ─── Table tenant_members ──────────────────────────────────────────────────
-- Roles :
--   owner   — creator, a tous les droits y compris suppression du tenant
--   admin   — peut inviter/retirer des membres, editer les settings
--   member  — user interne standard (equipe de l'imprimerie)
--   partner — acces partiel (typiquement : client B2B externe sur un sous-tenant,
--             ne voit que les donnees de son sous-tenant, pas les siblings)
create table if not exists public.tenant_members (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member'
             check (role in ('owner', 'admin', 'member', 'partner')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index if not exists tenant_members_user_idx on public.tenant_members(user_id);
create index if not exists tenant_members_tenant_idx on public.tenant_members(tenant_id);

-- ─── Table tenant_invitations ──────────────────────────────────────────────
create table if not exists public.tenant_invitations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  email       text not null,
  role        text not null default 'member'
              check (role in ('admin', 'member', 'partner')),
  token       text unique not null,  -- genere cote app (crypto.randomUUID + hash)
  expires_at  timestamptz not null,
  invited_by  uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists tenant_invitations_email_idx on public.tenant_invitations(email);
create index if not exists tenant_invitations_tenant_idx on public.tenant_invitations(tenant_id);

-- =============================================================================
-- ─── Fonctions helpers RLS (centralisees pour etre reutilisees) ────────────
-- =============================================================================

-- Retourne les tenant_ids auxquels auth.uid() a acces (direct OU en tant que
-- parent d'un sous-tenant). Utilise PARTOUT dans les policies RLS.
-- ⚠️  security definer + stable → appelable depuis policy sans recursion RLS.
create or replace function public.current_user_tenant_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  -- Tenants dont je suis membre direct
  select tenant_id from public.tenant_members where user_id = auth.uid()
  union
  -- Tenants dont je suis membre, ET leurs enfants (acces descendant)
  -- Exclut les partners : un partner ne voit que son propre sous-tenant.
  select t.id from public.tenants t
  where t.parent_tenant_id in (
    select tm.tenant_id from public.tenant_members tm
    where tm.user_id = auth.uid()
    and tm.role in ('owner', 'admin', 'member')
  );
$$;

-- Verifie si auth.uid() est superadmin (= membre du tenant system 'magrit-root').
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenant_members tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.user_id = auth.uid()
      and t.is_system_tenant = true
      and tm.role in ('owner', 'admin')
  );
$$;

-- Retourne le role de auth.uid() sur un tenant donne. Null si pas membre.
create or replace function public.user_role_in_tenant(p_tenant_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select role from public.tenant_members
  where tenant_id = p_tenant_id and user_id = auth.uid()
  limit 1;
$$;

-- =============================================================================
-- ─── RLS sur les tables tenants elles-memes ────────────────────────────────
-- =============================================================================

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_invitations enable row level security;

-- tenants : visible si je suis membre (direct ou parent), OU superadmin.
drop policy if exists "tenants_select" on public.tenants;
create policy "tenants_select" on public.tenants for select using (
  is_super_admin()
  or id in (select public.current_user_tenant_ids())
);

-- tenants : creation autorisee pour tout user connecte. Le owner doit etre
-- ajoute comme membre dans la meme transaction cote app (via fonction helper).
drop policy if exists "tenants_insert" on public.tenants;
create policy "tenants_insert" on public.tenants for insert with check (
  auth.uid() is not null
);

-- tenants : update reserve aux owner/admin ou superadmin.
drop policy if exists "tenants_update" on public.tenants;
create policy "tenants_update" on public.tenants for update using (
  is_super_admin()
  or public.user_role_in_tenant(id) in ('owner', 'admin')
);

-- tenants : delete reserve au owner ou superadmin.
drop policy if exists "tenants_delete" on public.tenants;
create policy "tenants_delete" on public.tenants for delete using (
  is_super_admin()
  or public.user_role_in_tenant(id) = 'owner'
);

-- tenant_members : visible si je suis membre du meme tenant, ou superadmin.
drop policy if exists "tenant_members_select" on public.tenant_members;
create policy "tenant_members_select" on public.tenant_members for select using (
  is_super_admin()
  or tenant_id in (select public.current_user_tenant_ids())
);

-- tenant_members : insert reserve au user qui cree le tenant (owner auto) OU
-- aux admins/owners du tenant pour ajouter des membres (utilise dans accept-invitation).
drop policy if exists "tenant_members_insert" on public.tenant_members;
create policy "tenant_members_insert" on public.tenant_members for insert with check (
  is_super_admin()
  or (user_id = auth.uid())  -- self-insert via accept-invitation
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

-- tenant_members : update et delete reserve aux admins du tenant (pour changer
-- un role ou retirer un membre). Un owner ne peut pas etre retire par un admin.
drop policy if exists "tenant_members_update" on public.tenant_members;
create policy "tenant_members_update" on public.tenant_members for update using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);
drop policy if exists "tenant_members_delete" on public.tenant_members;
create policy "tenant_members_delete" on public.tenant_members for delete using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
  or user_id = auth.uid()  -- quit self
);

-- tenant_invitations : visibles par les admins du tenant + l'invite (via token).
drop policy if exists "invitations_select" on public.tenant_invitations;
create policy "invitations_select" on public.tenant_invitations for select using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

drop policy if exists "invitations_insert" on public.tenant_invitations;
create policy "invitations_insert" on public.tenant_invitations for insert with check (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

drop policy if exists "invitations_update" on public.tenant_invitations;
create policy "invitations_update" on public.tenant_invitations for update using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);

drop policy if exists "invitations_delete" on public.tenant_invitations;
create policy "invitations_delete" on public.tenant_invitations for delete using (
  is_super_admin()
  or public.user_role_in_tenant(tenant_id) in ('owner', 'admin')
);
