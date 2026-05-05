-- =============================================================================
-- Migration E9.4 / v4 — Renommer un espace actif (admin + superadmin)
-- -----------------------------------------------------------------------------
-- Permet a un owner/admin de renommer son tenant (champ `name`).
-- Le slug ne peut etre change QUE par un superadmin Magrit (impact URL/SEO).
-- A chaque changement de slug, l'ancien est archive 90 jours pour permettre
-- la redirection 301 cote frontend (TenantAwareLayout).
-- =============================================================================

-- ─── 1. Historique des slugs pour redirection 301 ──────────────────────────
create table if not exists public.tenant_slug_history (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  old_slug    text not null,
  new_slug    text not null,
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now(),
  -- Le slug archive devient invalide apres expires_at (par defaut 90 jours).
  expires_at  timestamptz not null default (now() + interval '90 days')
);

create unique index if not exists tenant_slug_history_old_slug_idx
  on public.tenant_slug_history(old_slug)
  where expires_at > now();

create index if not exists tenant_slug_history_tenant_idx
  on public.tenant_slug_history(tenant_id);

-- RLS : tout user authentifie peut LIRE l'historique (pour resoudre une
-- redirection sans connaitre le tenant_id). L'insert est fait par trigger
-- avec security definer, donc pas de policy insert.
alter table public.tenant_slug_history enable row level security;

drop policy if exists "tenant_slug_history_select" on public.tenant_slug_history;
create policy "tenant_slug_history_select" on public.tenant_slug_history
  for select using (true);

-- ─── 2. Trigger : interdire le changement de slug aux non-superadmins ──────
create or replace function public.enforce_slug_change_authorization()
returns trigger language plpgsql security invoker as $$
begin
  if new.slug is distinct from old.slug then
    if not public.is_super_admin() then
      raise exception 'Only Magrit superadmins can change a tenant slug. (current: %)', old.slug;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_slug_change on public.tenants;
create trigger trg_enforce_slug_change
  before update of slug on public.tenants
  for each row execute function public.enforce_slug_change_authorization();

-- ─── 3. Trigger : archiver l'ancien slug quand il change ───────────────────
create or replace function public.archive_tenant_slug_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.slug is distinct from old.slug then
    insert into public.tenant_slug_history (tenant_id, old_slug, new_slug, changed_by)
    values (old.id, old.slug, new.slug, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_archive_slug_change on public.tenants;
create trigger trg_archive_slug_change
  after update of slug on public.tenants
  for each row execute function public.archive_tenant_slug_change();

-- ─── 4. RPC helper : resoudre un slug (current ou historique) ──────────────
-- Retourne le slug "vivant" associe a un slug donne (si l'utilisateur tape
-- l'ancien, on lui dit ou aller). Null si rien trouve.
create or replace function public.resolve_tenant_slug(p_slug text)
returns text
language sql stable security definer set search_path = public as $$
  with hist as (
    select t.slug
    from public.tenant_slug_history h
    join public.tenants t on t.id = h.tenant_id
    where h.old_slug = p_slug
      and h.expires_at > now()
    order by h.changed_at desc
    limit 1
  )
  select coalesce(
    (select slug from public.tenants where slug = p_slug),
    (select slug from hist)
  );
$$;

grant execute on function public.resolve_tenant_slug(text) to anon, authenticated;

notify pgrst, 'reload schema';
